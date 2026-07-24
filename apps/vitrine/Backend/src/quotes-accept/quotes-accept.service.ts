import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  acceptQuote,
  AcceptQuoteError,
  assertReplicaSetForTransactions,
  connectMongo,
  getClientAccountModel,
  getQuoteByAcceptToken,
  normalizeClientEmail,
  QuoteAcceptLookupError,
  quoteAcceptNeedsRegistration,
  registerClientAccountForQuoteAccept,
  EmailAlreadyRegisteredError,
  verifyClientAccountCredentials,
  AccountLockedError,
  AccountPendingActivationError,
} from "@coworkprysme/db";
import {
  CLIENT_ACCOUNT_LOCKED_USER_MESSAGE,
  CLIENT_ACCOUNT_PENDING_ACTIVATION_USER_MESSAGE,
  PRIVACY_POLICY_VERSION,
  PublicQuoteAcceptConfirmResponseSchema,
  PublicQuoteAcceptPreviewSchema,
  PublicQuoteAcceptRegisterResponseSchema,
  QUOTE_ACCEPT_ERROR_CODES,
  escapeEmailHtml,
  type PublicQuoteAcceptConfirmRequest,
  type PublicQuoteAcceptConfirmResponse,
  type PublicQuoteAcceptPreview,
  type PublicQuoteAcceptRegisterRequest,
  type PublicQuoteAcceptRegisterResponse,
} from "@coworkprysme/shared";
import { parseVitrineApiEnv } from "@coworkprysme/shared/server";
import { Types } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { InvoicePdfService } from "@coworkprysme/invoice-pdf";
import { MailService, mailDeliveryFromResult } from "../mail/mail.service.js";

/**
 * Public quote-accept surface — thin adapter over the shared domain `acceptQuote`.
 * Staff gestion path uses the exact same function (no parallel implementation).
 */
@Injectable()
export class QuotesAcceptService {
  private readonly logger = new Logger(QuotesAcceptService.name);

  constructor(
    private readonly mail: MailService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  private acceptTokenSecret(): string {
    return parseVitrineApiEnv().QUOTE_ACCEPT_TOKEN_SECRET;
  }

  private paymentLinkTokenSecret(): string {
    return parseVitrineApiEnv().QUOTE_PAYMENT_LINK_TOKEN_SECRET;
  }

  private publicSiteBaseUrl(): string {
    const fromEnv = process.env.PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (fromEnv) return fromEnv.replace(/\/$/, "");
    return "http://localhost:3001";
  }

  async preview(rawToken: string): Promise<PublicQuoteAcceptPreview> {
    try {
      const quote = await getQuoteByAcceptToken(rawToken, this.acceptTokenSecret());
      const { needsRegistration, email } = await quoteAcceptNeedsRegistration(quote);
      return PublicQuoteAcceptPreviewSchema.parse({
        quoteId: String(quote._id),
        reference: quote.reference,
        status: "sent",
        validUntil: quote.validUntil.toISOString(),
        emailMasked: maskEmail(email ?? quote.prospect?.email ?? ""),
        needsRegistration,
        paymentMethodPreferred: quote.paymentMethodPreferred,
        totals: {
          totalHT: quote.totals.ht,
          totalTTC: quote.totals.ttc,
          totalVAT: quote.totals.vat,
        },
      });
    } catch (error) {
      this.rethrowLookupError(error);
    }
  }

  /** Create active account before confirm (path: no account → register → accept). */
  async register(
    rawToken: string,
    body: PublicQuoteAcceptRegisterRequest,
  ): Promise<PublicQuoteAcceptRegisterResponse> {
    const quote = await this.loadSentQuote(rawToken);
    const email = quote.prospect?.email;
    if (!email) {
      throw new BadRequestException({
        code: QUOTE_ACCEPT_ERROR_CODES.VALIDATION_ERROR,
        message: "Le devis ne porte pas d'email prospect.",
      });
    }

    const mongooseInstance = await connectMongo();
    await assertReplicaSetForTransactions(mongooseInstance.connection);
    const session = await mongooseInstance.startSession();
    let clientAccountId: Types.ObjectId | undefined;
    try {
      await session.withTransaction(async () => {
        const created = await registerClientAccountForQuoteAccept({
          email,
          password: body.password,
          privacyPolicyVersion: PRIVACY_POLICY_VERSION,
          marketingCommunicationsAccepted: body.marketingCommunicationsAccepted,
          now: new Date(),
          session,
          prospect: quote.prospect,
        });
        clientAccountId = created.clientAccountId;
      });
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        throw new ConflictException({
          code: QUOTE_ACCEPT_ERROR_CODES.QUOTE_ACCEPT_EMAIL_REGISTERED,
          message: "Un compte existe déjà pour cet email. Connectez-vous puis acceptez le devis.",
        });
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (!clientAccountId) {
      throw new Error("Quote accept register failed");
    }

    return PublicQuoteAcceptRegisterResponseSchema.parse({
      clientAccount: {
        id: String(clientAccountId),
        email: normalizeClientEmail(email),
        status: "active",
      },
    });
  }

  /**
   * Final validation → unified `acceptQuote`.
   * - existing: `{ clientAccountId }` (account already active)
   * - create-on-the-fly: `{ password, privacyPolicyAccepted, cgvAccepted }` via client_register
   * - or login gate: use `confirmExistingWithPassword`
   */
  async confirm(
    rawToken: string,
    body: PublicQuoteAcceptConfirmRequest,
  ): Promise<PublicQuoteAcceptConfirmResponse> {
    const quote = await this.loadSentQuote(rawToken);

    let actor;
    if (body.clientAccountId) {
      actor = {
        kind: "client" as const,
        clientAccountId: new Types.ObjectId(body.clientAccountId),
      };
    } else if (body.password) {
      actor = {
        kind: "client_register" as const,
        password: body.password,
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
        marketingCommunicationsAccepted: body.marketingCommunicationsAccepted,
      };
    } else {
      throw new BadRequestException({
        code: QUOTE_ACCEPT_ERROR_CODES.VALIDATION_ERROR,
        message:
          "Indiquez soit clientAccountId (compte existant), soit password (création à la volée).",
      });
    }

    let result: Awaited<ReturnType<typeof acceptQuote>>;
    try {
      result = await acceptQuote({
        quoteId: quote._id,
        actor,
        paymentLinkTokenSecret: this.paymentLinkTokenSecret(),
      });
    } catch (error) {
      this.rethrowAcceptError(error);
    }

    let paymentUrl: string | undefined;
    if (result.paymentLink) {
      paymentUrl = `${this.publicSiteBaseUrl()}/payer-devis?token=${result.paymentLink.rawToken}&invoiceId=${String(result.invoiceId)}`;
      await this.sendQuotePaymentLinkEmail({
        reference: result.reference,
        recipientEmail: quote.prospect?.email,
        invoiceReference: result.invoiceReference,
        paymentUrl,
        amountDueCents: result.paymentLink.amountDueCents,
        expiresAt: result.paymentLink.expiresAt,
      });
    }

    return PublicQuoteAcceptConfirmResponseSchema.parse({
      quoteId: String(result.quoteId),
      reference: result.reference,
      reservationIds: result.reservationIds.map(String),
      invoiceId: String(result.invoiceId),
      invoiceReference: result.invoiceReference,
      cardexId: String(result.cardexId),
      clientAccountId: String(result.clientAccountId),
      status: "accepted",
      ...(paymentUrl ? { paymentUrl } : {}),
    });
  }

  /** Existing account: verify email+password then accept. */
  async confirmExistingWithPassword(
    rawToken: string,
    input: { email: string; password: string },
  ): Promise<PublicQuoteAcceptConfirmResponse> {
    await this.loadSentQuote(rawToken);
    try {
      const ok = await verifyClientAccountCredentials(input.email, input.password);
      if (!ok) {
        throw new ForbiddenException({
          code: QUOTE_ACCEPT_ERROR_CODES.QUOTE_ACCEPT_ACCOUNT_INVALID,
          message: "Email ou mot de passe incorrect.",
        });
      }
    } catch (error) {
      if (error instanceof AccountPendingActivationError) {
        throw new ForbiddenException({
          code: "ACCOUNT_PENDING_ACTIVATION",
          message: CLIENT_ACCOUNT_PENDING_ACTIVATION_USER_MESSAGE,
        });
      }
      if (error instanceof AccountLockedError) {
        throw new ForbiddenException({
          code: "ACCOUNT_LOCKED",
          message: CLIENT_ACCOUNT_LOCKED_USER_MESSAGE,
        });
      }
      if (error instanceof ForbiddenException) throw error;
      throw new ForbiddenException({
        code: QUOTE_ACCEPT_ERROR_CODES.QUOTE_ACCEPT_ACCOUNT_INVALID,
        message: "Email ou mot de passe incorrect.",
      });
    }

    const ClientAccount = await getClientAccountModel();
    const account = await ClientAccount.findOne({
      email: normalizeClientEmail(input.email),
      status: "active",
    })
      .select({ _id: 1 })
      .lean()
      .exec();
    if (!account) {
      throw new ForbiddenException({
        code: QUOTE_ACCEPT_ERROR_CODES.QUOTE_ACCEPT_ACCOUNT_INVALID,
        message: "Email ou mot de passe incorrect.",
      });
    }

    return this.confirm(rawToken, { clientAccountId: String(account._id) });
  }

  private async loadSentQuote(rawToken: string) {
    try {
      return await getQuoteByAcceptToken(rawToken, this.acceptTokenSecret());
    } catch (error) {
      this.rethrowLookupError(error);
    }
  }

  private rethrowLookupError(error: unknown): never {
    if (error instanceof QuoteAcceptLookupError) {
      const body = { code: error.code, message: error.message };
      if (error.code === "QUOTE_ACCEPT_EXPIRED") throw new GoneException(body);
      if (error.code === "QUOTE_ACCEPT_INVALID_STATUS") throw new ConflictException(body);
      throw new NotFoundException(body);
    }
    throw error;
  }

  private rethrowAcceptError(error: unknown): never {
    if (error instanceof AcceptQuoteError) {
      const body = { code: mapAcceptCode(error.code), message: error.message };
      if (error.code === "QUOTE_NOT_FOUND") throw new NotFoundException(body);
      if (error.code === "QUOTE_EXPIRED") throw new GoneException(body);
      if (
        error.code === "QUOTE_INVALID_STATUS" ||
        error.code === "SLOT_UNAVAILABLE" ||
        error.code === "ACCOUNT_ALREADY_EXISTS"
      ) {
        throw new ConflictException(body);
      }
      throw new BadRequestException(body);
    }
    throw error;
  }

  private async sendQuotePaymentLinkEmail(input: {
    reference: string;
    recipientEmail?: string;
    invoiceReference: string;
    paymentUrl: string;
    amountDueCents: number;
    expiresAt: Date;
  }): Promise<void> {
    const recipient = input.recipientEmail?.trim().toLowerCase();
    if (!recipient) {
      this.logger.warn(`quote accept payment email skipped — no recipient for ${input.reference}`);
      return;
    }
    try {
      const { pdf } = await this.invoicePdf.generatePdfForInvoiceReference(input.invoiceReference, {
        paymentUrl: input.paymentUrl,
      });
      const amountLabel = (input.amountDueCents / 100).toLocaleString("fr-FR", {
        style: "currency",
        currency: "EUR",
      });
      const expiresLabel = input.expiresAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
      const mailResult = await this.mail.sendMail({
        to: recipient,
        subject: `Payer votre réservation — devis ${input.reference}`,
        html: [
          `<p>Bonjour,</p>`,
          `<p>Votre devis <strong>${escapeEmailHtml(input.reference)}</strong> a été accepté.</p>`,
          `<p>Montant à régler&nbsp;: <strong>${escapeEmailHtml(amountLabel)}</strong> (valable jusqu'au ${escapeEmailHtml(expiresLabel)}).</p>`,
          `<p><a href="${escapeEmailHtml(input.paymentUrl)}">Payer par carte</a></p>`,
          `<p>La facture proforma (avec QR code) est jointe.</p>`,
          `<p>Cordialement,<br/>Cowork Prysme</p>`,
        ].join("\n"),
        attachments: [
          {
            filename: `${input.invoiceReference}.pdf`,
            content: pdf,
            contentType: "application/pdf",
          },
        ],
      });
      void mailDeliveryFromResult(mailResult);
    } catch (error) {
      this.logger.error(
        `quote accept payment email failed for ${input.reference}: ${String(error)}`,
      );
    }
  }
}

function mapAcceptCode(code: AcceptQuoteError["code"]): string {
  switch (code) {
    case "QUOTE_EXPIRED":
      return QUOTE_ACCEPT_ERROR_CODES.QUOTE_ACCEPT_EXPIRED;
    case "QUOTE_INVALID_STATUS":
      return QUOTE_ACCEPT_ERROR_CODES.QUOTE_ACCEPT_INVALID_STATUS;
    case "QUOTE_NOT_FOUND":
      return QUOTE_ACCEPT_ERROR_CODES.QUOTE_ACCEPT_NOT_FOUND;
    case "SLOT_UNAVAILABLE":
      return QUOTE_ACCEPT_ERROR_CODES.QUOTE_ACCEPT_SLOT_UNAVAILABLE;
    case "ACCOUNT_ALREADY_EXISTS":
      return QUOTE_ACCEPT_ERROR_CODES.QUOTE_ACCEPT_EMAIL_REGISTERED;
    case "ACCOUNT_INVALID":
    case "ACCOUNT_REQUIRED":
      return QUOTE_ACCEPT_ERROR_CODES.QUOTE_ACCEPT_ACCOUNT_INVALID;
    default:
      return QUOTE_ACCEPT_ERROR_CODES.VALIDATION_ERROR;
  }
}

function maskEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

/** Re-export for tests proving both API layers import the same domain function. */
export { acceptQuote as sharedAcceptQuoteDomain };
