import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  applyStripeCardPayment,
  confirmReservationAfterCardPayment,
  connectMongo,
  consumeQuotePaymentLink,
  getInvoiceModel,
  getQuoteModel,
  getQuotePaymentLinkModel,
  InvoiceNotFoundError,
  redeemQuotePaymentLink,
  QuotePaymentLinkLookupError,
  StripePaymentAmountMismatchError,
} from "@coworkprysme/db";
import {
  QUOTE_PAYMENT_LINK_ERROR_CODES,
  type CreateQuotePaymentIntentRequest,
  type CreateQuotePaymentIntentResponse,
  type QuotePaymentLinkPreview,
  type QuotePaymentLinkPreviewQuery,
  type QuotePaymentStatusQuery,
  type QuotePaymentStatusResponse,
} from "@coworkprysme/shared";
import { parseVitrineApiEnv } from "@coworkprysme/shared/server";
import type Stripe from "stripe";

import { createStripeClient, loadStripeConfig } from "../stripe/stripe.config.js";

/**
 * Devis Stripe payment-link surface (Option B — /payer-devis + Elements).
 * Distinct from booking hold: persisted opaque token, expiresAt = validUntil.
 */
@Injectable()
export class QuotePaymentService {
  private readonly logger = new Logger(QuotePaymentService.name);
  private stripe: Stripe | null = null;

  private tokenSecret(): string {
    return parseVitrineApiEnv().QUOTE_PAYMENT_LINK_TOKEN_SECRET;
  }

  private ensureStripe(): Stripe {
    if (this.stripe) return this.stripe;
    const config = loadStripeConfig();
    if (!config) {
      throw new ServiceUnavailableException({
        code: QUOTE_PAYMENT_LINK_ERROR_CODES.STRIPE_NOT_CONFIGURED,
        message: "Paiement par carte indisponible (Stripe non configuré)",
      });
    }
    this.stripe = createStripeClient(config.secretKey);
    return this.stripe;
  }

  async preview(query: QuotePaymentLinkPreviewQuery): Promise<QuotePaymentLinkPreview> {
    const link = await this.redeemOrThrow(query.token, query.invoiceId);
    await connectMongo();
    const Invoice = await getInvoiceModel();
    const Quote = await getQuoteModel();
    const invoice = await Invoice.findById(link.invoiceId).lean().exec();
    const quote = await Quote.findById(link.quoteId).lean().exec();
    if (!invoice || !quote) {
      throw new NotFoundException({
        code: QUOTE_PAYMENT_LINK_ERROR_CODES.PAYMENT_LINK_NOT_FOUND,
        message: "Lien de paiement introuvable.",
      });
    }

    const isDeposit =
      (quote.depositPercent ?? 0) > 0 && link.amountDueCentsSnapshot < invoice.totals.ttc;

    return {
      invoiceId: String(invoice._id),
      invoiceReference: invoice.reference,
      quoteId: String(quote._id),
      quoteReference: quote.reference,
      amountDueCents: link.amountDueCentsSnapshot,
      currency: "eur",
      expiresAt: link.expiresAt.toISOString(),
      isDeposit,
      reservationIds: link.reservationIds.map(String),
    };
  }

  async createPaymentIntent(
    input: CreateQuotePaymentIntentRequest,
  ): Promise<CreateQuotePaymentIntentResponse> {
    const link = await this.redeemOrThrow(input.token, input.invoiceId);
    const stripe = this.ensureStripe();
    await connectMongo();
    const Invoice = await getInvoiceModel();
    const invoice = await Invoice.findById(link.invoiceId).exec();
    if (!invoice || invoice.type !== "proforma") {
      throw new BadRequestException({
        code: QUOTE_PAYMENT_LINK_ERROR_CODES.INVOICE_NOT_PAYABLE,
        message: "Cette facture n'accepte pas de paiement carte",
      });
    }

    const amount = link.amountDueCentsSnapshot;
    if (amount > invoice.totals.balanceDue) {
      throw new BadRequestException({
        code: QUOTE_PAYMENT_LINK_ERROR_CODES.INVOICE_NOT_PAYABLE,
        message: "Montant dû incohérent avec le solde de la facture",
      });
    }

    const createdIntent = await stripe.paymentIntents.create(
      {
        amount,
        currency: "eur",
        automatic_payment_methods: { enabled: true },
        metadata: {
          invoiceId: invoice._id.toString(),
          invoiceReference: invoice.reference,
          reservationId: link.reservationIds[0]?.toString() ?? "",
          quoteId: link.quoteId.toString(),
          paymentLinkId: link._id.toString(),
        },
      },
      {
        idempotencyKey: `quote-pi-${link._id.toString()}-${amount}`,
      },
    );

    const QuotePaymentLink = await getQuotePaymentLinkModel();
    await QuotePaymentLink.updateOne(
      { _id: link._id, status: "active" },
      { $set: { stripePaymentIntentId: createdIntent.id } },
    ).exec();

    if (!createdIntent.client_secret) {
      throw new ServiceUnavailableException({
        code: QUOTE_PAYMENT_LINK_ERROR_CODES.STRIPE_NOT_CONFIGURED,
        message: "Impossible de créer le paiement Stripe",
      });
    }

    return {
      clientSecret: createdIntent.client_secret,
      paymentIntentId: createdIntent.id,
      amountDueCents: amount,
      currency: "eur",
      invoiceReference: invoice.reference,
    };
  }

  async getStatus(query: QuotePaymentStatusQuery): Promise<QuotePaymentStatusResponse> {
    try {
      const link = await redeemQuotePaymentLink({
        rawToken: query.token,
        invoiceId: query.invoiceId,
        tokenSecret: this.tokenSecret(),
      });
      await connectMongo();
      const Invoice = await getInvoiceModel();
      const invoice = await Invoice.findById(link.invoiceId).lean().exec();
      if (!invoice) {
        throw new NotFoundException({
          code: QUOTE_PAYMENT_LINK_ERROR_CODES.PAYMENT_LINK_NOT_FOUND,
          message: "Lien de paiement introuvable.",
        });
      }
      return {
        paymentState: this.mapPaymentState(invoice.status, invoice.totals.balanceDue),
        amountDueCents: link.amountDueCentsSnapshot,
        invoiceReference: invoice.reference,
        linkStatus: link.status,
      };
    } catch (error) {
      if (error instanceof QuotePaymentLinkLookupError) {
        if (error.code === "PAYMENT_LINK_CONSUMED") {
          await connectMongo();
          const Invoice = await getInvoiceModel();
          const invoice = await Invoice.findById(query.invoiceId).lean().exec();
          return {
            paymentState: invoice
              ? this.mapPaymentState(invoice.status, invoice.totals.balanceDue)
              : "paid",
            amountDueCents: 0,
            invoiceReference: invoice?.reference ?? "",
            linkStatus: "consumed",
          };
        }
        this.rethrowLookup(error);
      }
      throw error;
    }
  }

  /**
   * Webhook branch for quote payments (metadata.quoteId present).
   * Returns true when handled (caller must skip booking path).
   */
  async handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent): Promise<boolean> {
    const quoteId = pi.metadata?.quoteId?.trim();
    if (!quoteId) {
      return false;
    }

    const invoiceId = pi.metadata?.invoiceId?.trim();
    const paymentLinkId = pi.metadata?.paymentLinkId?.trim();
    if (!invoiceId || !paymentLinkId) {
      this.logger.error(
        `quote payment_intent.succeeded ${pi.id} missing invoiceId/paymentLinkId metadata`,
      );
      return true;
    }

    await connectMongo();
    const QuotePaymentLink = await getQuotePaymentLinkModel();
    const link = await QuotePaymentLink.findById(paymentLinkId).exec();
    if (!link || String(link.quoteId) !== quoteId || String(link.invoiceId) !== invoiceId) {
      this.logger.error(
        `quote payment_intent.succeeded ${pi.id}: payment link membership mismatch`,
      );
      return true;
    }

    const amountReceived = pi.amount_received > 0 ? pi.amount_received : pi.amount;
    try {
      const result = await applyStripeCardPayment({
        stripePaymentIntentId: pi.id,
        invoiceId,
        amountReceived,
        expectedAmountCents: link.amountDueCentsSnapshot,
      });
      this.logger.log(
        `Applied quote Stripe payment pi=${pi.id} invoice=${invoiceId} applied=${result.applied}`,
      );

      // Option A — confirm ALL reservations linked to the quote group.
      for (const reservationId of link.reservationIds) {
        const confirmed = await confirmReservationAfterCardPayment({
          reservationId: String(reservationId),
        });
        this.logger.log(
          `Quote reservation after card payment id=${reservationId} transitioned=${confirmed.transitioned}`,
        );
      }

      await consumeQuotePaymentLink({
        paymentLinkId: link._id,
        stripePaymentIntentId: pi.id,
      });
    } catch (error) {
      if (error instanceof InvoiceNotFoundError) {
        this.logger.error(`quote payment_intent.succeeded ${pi.id}: invoice not found`);
        return true;
      }
      if (error instanceof StripePaymentAmountMismatchError) {
        this.logger.error(
          `quote payment_intent.succeeded ${pi.id}: amount mismatch received=${error.amountReceived}`,
        );
        return true;
      }
      throw error;
    }

    return true;
  }

  private async redeemOrThrow(token: string, invoiceId: string) {
    try {
      return await redeemQuotePaymentLink({
        rawToken: token,
        invoiceId,
        tokenSecret: this.tokenSecret(),
      });
    } catch (error) {
      if (error instanceof QuotePaymentLinkLookupError) {
        this.rethrowLookup(error);
      }
      throw error;
    }
  }

  private rethrowLookup(error: QuotePaymentLinkLookupError): never {
    const body = { code: error.code, message: error.message };
    if (error.code === "PAYMENT_LINK_EXPIRED") throw new GoneException(body);
    if (error.code === "PAYMENT_LINK_CONSUMED" || error.code === "PAYMENT_LINK_REVOKED") {
      throw new ConflictException(body);
    }
    throw new NotFoundException(body);
  }

  private mapPaymentState(
    status: string,
    balanceDue: number,
  ): QuotePaymentStatusResponse["paymentState"] {
    if (status === "paid" || balanceDue === 0) return "paid";
    if (status === "partially_paid") return "partially_paid";
    return "awaiting_payment";
  }
}
