import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  applyStripeCardPayment,
  confirmReservationAfterCardPayment,
  connectMongo,
  getInvoiceModel,
  getReservationModel,
  InvoiceNotFoundError,
  StripePaymentAmountMismatchError,
  type Invoice,
} from "@coworkprysme/db";
import {
  BOOKING_PAYMENT_ACCESS_TOKEN_TTL_MS,
  BOOKING_PAYMENT_ERROR_CODES,
  type BookingPaymentStatusResponse,
  type CreateBookingPaymentIntentRequest,
  type CreateBookingPaymentIntentResponse,
} from "@coworkprysme/shared";
import type Stripe from "stripe";

import { createStripeClient, loadStripeConfig } from "./stripe.config.js";
import { assertBookingPaymentAccessToken } from "./booking-payment-token.js";
/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime class reference */
import { BookingEmailsService } from "../booking/booking-emails.service.js";

/** @deprecated Prefer BOOKING_PAYMENT_ACCESS_TOKEN_TTL_MS from shared — kept for local imports. */
export const BOOKING_PAYMENT_INTENT_TTL_MS = BOOKING_PAYMENT_ACCESS_TOKEN_TTL_MS;

/**
 * Payment intent / status require HMAC paymentAccessToken issued at confirm
 * (+ 24h invoice TTL). Sequential references alone are not sufficient.
 */
@Injectable()
export class BookingPaymentService {
  private readonly logger = new Logger(BookingPaymentService.name);
  private stripe: Stripe | null = null;
  private webhookSecret: string | null = null;

  constructor(private readonly bookingEmails: BookingEmailsService) {}

  private ensureStripe(): Stripe {
    if (this.stripe && this.webhookSecret) {
      return this.stripe;
    }
    const config = loadStripeConfig();
    if (!config) {
      throw new ServiceUnavailableException({
        code: BOOKING_PAYMENT_ERROR_CODES.STRIPE_NOT_CONFIGURED,
        message: "Paiement par carte indisponible (Stripe non configuré)",
      });
    }
    this.stripe = createStripeClient(config.secretKey);
    this.webhookSecret = config.webhookSecret;
    return this.stripe;
  }

  getWebhookSecret(): string {
    this.ensureStripe();
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException({
        code: BOOKING_PAYMENT_ERROR_CODES.STRIPE_NOT_CONFIGURED,
        message: "Paiement par carte indisponible (Stripe non configuré)",
      });
    }
    return this.webhookSecret;
  }

  getStripe(): Stripe {
    return this.ensureStripe();
  }

  async createPaymentIntent(
    input: CreateBookingPaymentIntentRequest,
  ): Promise<CreateBookingPaymentIntentResponse> {
    assertBookingPaymentAccessToken({
      token: input.paymentAccessToken,
      reservationReference: input.reservationReference,
      invoiceReference: input.invoiceReference,
    });

    const stripe = this.ensureStripe();
    const { invoice, reservation } = await this.loadPayableInvoicePair(input);

    // Card PaymentIntents only for unpaid card holds — never bank_transfer / confirmed / etc.
    if (reservation.status !== "awaiting_payment" || reservation.awaitingPaymentMethod !== "card") {
      throw new BadRequestException({
        code: BOOKING_PAYMENT_ERROR_CODES.INVOICE_NOT_PAYABLE,
        message: "Cette réservation n'accepte pas de paiement carte",
      });
    }

    if (
      reservation.awaitingPaymentExpiresAt &&
      new Date(reservation.awaitingPaymentExpiresAt).getTime() <= Date.now()
    ) {
      throw new BadRequestException({
        code: BOOKING_PAYMENT_ERROR_CODES.INVOICE_EXPIRED,
        message: "Le délai de paiement pour cette réservation est dépassé",
      });
    }

    // Amount ALWAYS from cowork_bdd invoice — never trust a client amount.
    const amount = invoice.totals.balanceDue;
    if (amount <= 0) {
      throw new ConflictException({
        code: BOOKING_PAYMENT_ERROR_CODES.ALREADY_PAID,
        message: "Cette facture est déjà soldée",
      });
    }

    const currency = (invoice.currency || "EUR").toLowerCase();
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount,
        currency,
        automatic_payment_methods: { enabled: true },
        metadata: {
          invoiceId: invoice._id.toString(),
          invoiceReference: invoice.reference,
          reservationId: invoice.reservationId?.toString() ?? "",
          reservationReference: reservation.reference,
        },
      },
      {
        idempotencyKey: `pi-${invoice._id.toString()}-${amount}`,
      },
    );

    if (!paymentIntent.client_secret) {
      throw new ServiceUnavailableException({
        code: BOOKING_PAYMENT_ERROR_CODES.STRIPE_NOT_CONFIGURED,
        message: "Impossible de créer le paiement Stripe",
      });
    }

    // Persist PI id so expiry can cancel it on Stripe.
    const Reservation = await getReservationModel();
    await Reservation.updateOne(
      { _id: reservation._id },
      { $set: { stripePaymentIntentId: paymentIntent.id } },
    ).exec();

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
      currency,
    };
  }

  async getPaymentStatus(input: {
    reservationReference: string;
    invoiceReference: string;
    paymentAccessToken: string;
  }): Promise<BookingPaymentStatusResponse> {
    assertBookingPaymentAccessToken({
      token: input.paymentAccessToken,
      reservationReference: input.reservationReference,
      invoiceReference: input.invoiceReference,
    });

    const { invoice, reservation } = await this.loadInvoicePair(input, { requirePayable: false });

    const paymentState = this.mapPaymentState(invoice);

    return {
      reservationReference: input.reservationReference,
      invoiceReference: invoice.reference,
      invoiceStatus: invoice.status as BookingPaymentStatusResponse["invoiceStatus"],
      invoiceType: "proforma",
      paidTotal: invoice.totals.paidTotal,
      balanceDue: invoice.totals.balanceDue,
      paymentState,
      reservationStatus: reservation.status as BookingPaymentStatusResponse["reservationStatus"],
    };
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Stripe webhook received type=${event.type} id=${event.id}`);

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      await this.onPaymentIntentSucceeded(pi);
      return;
    }

    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;
      this.logger.warn(
        `Stripe payment_intent.payment_failed id=${pi.id} invoice=${pi.metadata?.invoiceReference ?? "?"}`,
      );
      return;
    }

    this.logger.log(`Stripe webhook ignored type=${event.type}`);
  }

  private async onPaymentIntentSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
    const invoiceId = pi.metadata?.invoiceId?.trim();
    if (!invoiceId) {
      this.logger.error(`payment_intent.succeeded ${pi.id} missing metadata.invoiceId`);
      return;
    }

    const amountReceived = pi.amount_received > 0 ? pi.amount_received : pi.amount;
    try {
      const result = await applyStripeCardPayment({
        stripePaymentIntentId: pi.id,
        invoiceId,
        amountReceived,
      });
      this.logger.log(
        `Applied Stripe payment pi=${pi.id} invoice=${invoiceId} applied=${result.applied} status=${result.invoice.status} type=${result.invoice.type}`,
      );

      const reservationId =
        pi.metadata?.reservationId?.trim() || result.invoice.reservationId?.toString();
      if (reservationId) {
        const confirmed = await confirmReservationAfterCardPayment({ reservationId });
        this.logger.log(
          `Reservation after card payment id=${reservationId} transitioned=${confirmed.transitioned} status=${confirmed.reservation.status}`,
        );
        if (confirmed.transitioned) {
          await this.bookingEmails.sendEmailsAfterCardPayment({
            reservationId,
            invoiceReference: result.invoice.reference,
          });
        }
      } else {
        this.logger.error(
          `payment_intent.succeeded ${pi.id}: no reservationId to confirm after payment`,
        );
      }
    } catch (error) {
      if (error instanceof InvoiceNotFoundError) {
        this.logger.error(`payment_intent.succeeded ${pi.id}: invoice not found ${invoiceId}`);
        return;
      }
      if (error instanceof StripePaymentAmountMismatchError) {
        this.logger.error(
          `payment_intent.succeeded ${pi.id}: amount mismatch received=${error.amountReceived} balanceDue=${error.balanceDue} invoice=${invoiceId}`,
        );
        return;
      }
      throw error;
    }
  }

  private mapPaymentState(invoice: Invoice): BookingPaymentStatusResponse["paymentState"] {
    if (invoice.status === "paid" || invoice.totals.balanceDue === 0) {
      return "paid";
    }
    if (invoice.status === "partially_paid" || invoice.totals.paidTotal > 0) {
      return "partially_paid";
    }
    return "awaiting_payment";
  }

  private async loadPayableInvoicePair(input: {
    reservationReference: string;
    invoiceReference: string;
  }) {
    return this.loadInvoicePair(input, { requirePayable: true });
  }

  private async loadInvoicePair(
    input: { reservationReference: string; invoiceReference: string },
    options: { requirePayable: boolean },
  ) {
    await connectMongo();
    const Reservation = await getReservationModel();
    const Invoice = await getInvoiceModel();

    const reservation = await Reservation.findOne({ reference: input.reservationReference })
      .lean()
      .exec();
    if (!reservation) {
      throw new NotFoundException({
        code: BOOKING_PAYMENT_ERROR_CODES.INVOICE_NOT_FOUND,
        message: "Réservation introuvable",
      });
    }

    const invoice = await Invoice.findOne({ reference: input.invoiceReference }).exec();
    if (!invoice) {
      throw new NotFoundException({
        code: BOOKING_PAYMENT_ERROR_CODES.INVOICE_NOT_FOUND,
        message: "Facture introuvable",
      });
    }

    if (!invoice.reservationId || invoice.reservationId.toString() !== reservation._id.toString()) {
      throw new BadRequestException({
        code: BOOKING_PAYMENT_ERROR_CODES.RESERVATION_MISMATCH,
        message: "La facture ne correspond pas à cette réservation",
      });
    }

    if (invoice.type !== "proforma") {
      throw new BadRequestException({
        code: BOOKING_PAYMENT_ERROR_CODES.INVOICE_NOT_PAYABLE,
        message: "Cette facture n'accepte pas de paiement carte",
      });
    }

    const issuedAt = invoice.issuedAt ?? invoice.createdAt;
    const ageMs = Date.now() - new Date(issuedAt).getTime();
    if (ageMs > BOOKING_PAYMENT_INTENT_TTL_MS) {
      throw new BadRequestException({
        code: BOOKING_PAYMENT_ERROR_CODES.INVOICE_EXPIRED,
        message: "Le délai de paiement en ligne pour cette facture est dépassé",
      });
    }

    if (options.requirePayable && invoice.totals.balanceDue <= 0) {
      throw new ConflictException({
        code: BOOKING_PAYMENT_ERROR_CODES.ALREADY_PAID,
        message: "Cette facture est déjà soldée",
      });
    }

    return {
      invoice,
      reservation,
      reservationReference: reservation.reference as string,
    };
  }
}
