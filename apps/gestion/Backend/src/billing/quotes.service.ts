import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  assertReplicaSetForTransactions,
  acceptQuote,
  AcceptQuoteError,
  attachQuoteAcceptToken,
  buildStaffQuoteLockSessionId,
  connectMongo,
  getAuditLogModel,
  getCardexModel,
  getClientAccountModel,
  getQuoteModel,
  nextReference,
  type Quote,
  type QuoteDocument,
  type StaffProfileDocument,
} from "@coworkprysme/db";
import {
  buildQuotePdfViewModel,
  loadInvoiceIssuerConfig,
  loadInvoiceLogoDataUri,
  loadInvoicePdfBankRib,
} from "@coworkprysme/invoice-pdf";
import type { QuotePdfSourceCardex } from "@coworkprysme/invoice-pdf";
import {
  BILLING_QUOTES_ERROR_CODES,
  BILLING_QUOTES_ERROR_MESSAGES,
  QuoteSendProspectSchema,
  StaffAcceptQuoteResponseSchema,
  StaffDeleteQuoteResponseSchema,
  StaffQuoteListResponseSchema,
  StaffQuoteSchema,
  StaffSendQuoteResponseSchema,
  recomputeQuotePricing,
  type StaffAcceptQuoteResponse,
  type StaffCreateQuoteRequest,
  type StaffQuote,
  type StaffQuoteLineInput,
  type StaffQuoteListQuery,
  type StaffQuoteListResponse,
  type StaffSendQuoteResponse,
  type StaffUpdateQuoteRequest,
  emailDetailRow,
  escapeEmailHtml,
  renderCoworkEmailLayout,
  resolvePublicSiteUrl,
} from "@coworkprysme/shared";
import { parseGestionApiEnv } from "@coworkprysme/shared/server";
import type { Types } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { InvoicePdfService } from "@coworkprysme/invoice-pdf";
import {
  MailService,
  emailDeliveryAuditDiff,
  mailDeliveryFromResult,
} from "../mail/mail.service.js";
import { writeQuoteAudit } from "./quotes-audit.js";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

function assertObjectId(value: string, label: string): string {
  if (!OBJECT_ID_PATTERN.test(value)) {
    throw new BadRequestException({
      code: BILLING_QUOTES_ERROR_CODES.INVALID_ID,
      message: `${label} invalide`,
    });
  }
  return value;
}

function toIso(value: Date | string | undefined | null): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

/** Clear optional ObjectId refs (mongoose casts string → ObjectId on save). */
function clearableId(value: string | null | undefined): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return value;
}

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly mail: MailService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  async create(profile: StaffProfileDocument, input: StaffCreateQuoteRequest): Promise<StaffQuote> {
    const mongooseInstance = await connectMongo();
    await assertReplicaSetForTransactions(mongooseInstance.connection);

    const priced = this.buildPricedLines(input.lines, String(profile._id), input.depositPercent);
    const paymentSituation =
      input.paymentSituation ?? (input.depositPercent > 0 ? "deposit" : undefined);

    const session = await mongooseInstance.startSession();
    try {
      let created: QuoteDocument | undefined;
      await session.withTransaction(async () => {
        const reference = await nextReference("DEV", session);
        const QuoteModel = await getQuoteModel();
        const [doc] = await QuoteModel.create(
          [
            {
              reference,
              currency: "EUR",
              ...(input.cardexId ? { cardexId: input.cardexId } : {}),
              ...(input.clientAccountId ? { clientAccountId: input.clientAccountId } : {}),
              ...(input.prospect ? { prospect: input.prospect } : {}),
              reservationIds: [],
              lines: priced.lines,
              vatBreakdown: priced.vatBreakdown,
              totals: priced.totals,
              depositPercent: input.depositPercent,
              depositAmountHT: priced.deposit.depositAmountHT,
              depositAmountTTC: priced.deposit.depositAmountTTC,
              depositVatBreakdown: priced.deposit.depositVatBreakdown,
              ...(paymentSituation ? { paymentSituation } : {}),
              ...(input.paymentMethodPreferred
                ? { paymentMethodPreferred: input.paymentMethodPreferred }
                : {}),
              status: "draft",
              validUntil: new Date(input.validUntil),
              ...(input.internalNote ? { internalNote: input.internalNote } : {}),
              ...(input.publicConditions ? { publicConditions: input.publicConditions } : {}),
              ...(input.paymentTermsLabel ? { paymentTermsLabel: input.paymentTermsLabel } : {}),
              createdByStaffProfileId: profile._id,
            },
          ],
          { session },
        );
        created = doc;
      });
      if (!created) {
        throw new Error("Quote creation failed within transaction");
      }
      return this.mapQuote(created);
    } finally {
      await session.endSession();
    }
  }

  async list(query: StaffQuoteListQuery): Promise<StaffQuoteListResponse> {
    await connectMongo();
    const QuoteModel = await getQuoteModel();
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.cardexId) filter.cardexId = query.cardexId;
    if (query.q) {
      const q = query.q.trim();
      const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = { $regex: escapeRegex(q), $options: "i" };
      const Cardex = await getCardexModel();
      const matchingCardexes = await Cardex.find({
        $or: [
          { "identity.firstName": rx },
          { "identity.lastName": rx },
          { "company.legalName": rx },
        ],
      })
        .select({ _id: 1 })
        .lean()
        .exec();
      const cardexIds = matchingCardexes.map((row) => row._id);
      filter.$or = [
        { reference: rx },
        { "prospect.email": rx },
        { "prospect.firstName": rx },
        { "prospect.lastName": rx },
        { "prospect.displayName": rx },
        { "prospect.companyName": rx },
        ...(cardexIds.length > 0 ? [{ cardexId: { $in: cardexIds } }] : []),
      ];
    }

    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      QuoteModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(query.pageSize)
        .lean()
        .exec(),
      QuoteModel.countDocuments(filter).exec(),
    ]);

    const cardexIdSet = [
      ...new Set(
        rows
          .map((row) => (row.cardexId ? String(row.cardexId) : null))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const Cardex = await getCardexModel();
    const cardexRows =
      cardexIdSet.length > 0
        ? await Cardex.find({ _id: { $in: cardexIdSet } })
            .select({ identity: 1, company: 1 })
            .lean()
            .exec()
        : [];
    const cardexById = new Map(cardexRows.map((row) => [String(row._id), row]));

    return StaffQuoteListResponseSchema.parse({
      quotes: rows.map((row) => {
        const mapped = this.mapQuote(row as Quote & { _id: Types.ObjectId });
        const cardex = mapped.cardexId ? cardexById.get(mapped.cardexId) : undefined;
        const { clientLabel, companyLegalName } = this.resolveClientDisplay(mapped, cardex);
        return {
          id: mapped.id,
          reference: mapped.reference,
          status: mapped.status,
          ...(mapped.cardexId ? { cardexId: mapped.cardexId } : {}),
          ...(mapped.clientAccountId ? { clientAccountId: mapped.clientAccountId } : {}),
          ...(mapped.prospect ? { prospect: mapped.prospect } : {}),
          totals: mapped.totals,
          depositPercent: mapped.depositPercent,
          ...(mapped.depositAmountTTC !== undefined
            ? { depositAmountTTC: mapped.depositAmountTTC }
            : {}),
          ...(mapped.paymentMethodPreferred
            ? { paymentMethodPreferred: mapped.paymentMethodPreferred }
            : {}),
          validUntil: mapped.validUntil,
          ...(mapped.sentAt ? { sentAt: mapped.sentAt } : {}),
          createdAt: mapped.createdAt,
          updatedAt: mapped.updatedAt,
          clientLabel,
          companyLegalName,
        };
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async getById(id: string): Promise<StaffQuote> {
    const quote = await this.loadQuote(id);
    const mapped = this.mapQuote(quote);
    let cardex: {
      identity?: { firstName?: string; lastName?: string };
      company?: { legalName?: string };
    } | null = null;
    if (mapped.cardexId) {
      const Cardex = await getCardexModel();
      cardex = await Cardex.findById(mapped.cardexId)
        .select({ identity: 1, company: 1 })
        .lean()
        .exec();
    }
    const display = this.resolveClientDisplay(mapped, cardex);
    return { ...mapped, ...display };
  }

  async update(
    profile: StaffProfileDocument,
    id: string,
    input: StaffUpdateQuoteRequest,
  ): Promise<StaffQuote> {
    await connectMongo();
    const quote = await this.loadQuote(id);

    if (quote.status === "sent") {
      const keys = Object.keys(input).filter(
        (k) => input[k as keyof StaffUpdateQuoteRequest] !== undefined,
      );
      if (keys.length === 0 || keys.some((k) => k !== "internalNote")) {
        throw new ConflictException({
          code: BILLING_QUOTES_ERROR_CODES.QUOTE_NOT_DRAFT,
          message: "Un devis envoyé ne peut être modifié que sur la note interne (internalNote).",
        });
      }
      if (input.internalNote === null) {
        quote.internalNote = undefined;
      } else if (input.internalNote !== undefined) {
        quote.internalNote = input.internalNote;
      }
      await quote.save();
      return this.mapQuote(quote);
    }

    if (quote.status !== "draft") {
      throw new ConflictException({
        code: BILLING_QUOTES_ERROR_CODES.QUOTE_NOT_DRAFT,
        message: BILLING_QUOTES_ERROR_MESSAGES.QUOTE_NOT_DRAFT,
      });
    }

    if (input.cardexId !== undefined) {
      quote.cardexId = clearableId(input.cardexId ?? undefined) as QuoteDocument["cardexId"];
    }
    if (input.clientAccountId !== undefined) {
      quote.clientAccountId = clearableId(
        input.clientAccountId ?? undefined,
      ) as QuoteDocument["clientAccountId"];
    }
    if (input.prospect !== undefined) {
      quote.prospect = input.prospect ?? undefined;
    }
    if (input.validUntil !== undefined) {
      quote.validUntil = new Date(input.validUntil);
    }
    if (input.paymentMethodPreferred !== undefined) {
      quote.paymentMethodPreferred = input.paymentMethodPreferred;
    }
    if (input.paymentSituation !== undefined) {
      quote.paymentSituation = input.paymentSituation;
    }
    if (input.internalNote !== undefined) {
      quote.internalNote = input.internalNote ?? undefined;
    }
    if (input.publicConditions !== undefined) {
      quote.publicConditions = input.publicConditions ?? undefined;
    }
    if (input.paymentTermsLabel !== undefined) {
      quote.paymentTermsLabel = input.paymentTermsLabel ?? undefined;
    }

    if (input.lines !== undefined || input.depositPercent !== undefined) {
      const lineInputs = input.lines ?? this.linesToInput(quote);
      const depositPercent = input.depositPercent ?? quote.depositPercent;
      const priced = this.buildPricedLines(lineInputs, String(profile._id), depositPercent);
      quote.lines = priced.lines as Quote["lines"];
      quote.vatBreakdown = priced.vatBreakdown;
      quote.totals = priced.totals;
      quote.depositPercent = depositPercent;
      quote.depositAmountHT = priced.deposit.depositAmountHT;
      quote.depositAmountTTC = priced.deposit.depositAmountTTC;
      quote.depositVatBreakdown = priced.deposit.depositVatBreakdown;
      if (!quote.paymentSituation && depositPercent > 0) {
        quote.paymentSituation = "deposit";
      }
    }

    await quote.save();
    return this.mapQuote(quote);
  }

  async deleteDraft(profile: StaffProfileDocument, id: string) {
    await connectMongo();
    const quote = await this.loadQuote(id);
    if (quote.status !== "draft") {
      throw new ConflictException({
        code: BILLING_QUOTES_ERROR_CODES.QUOTE_NOT_DRAFT,
        message: BILLING_QUOTES_ERROR_MESSAGES.QUOTE_NOT_DRAFT,
      });
    }

    const quoteId = quote._id;
    const reference = quote.reference;
    await quote.deleteOne();

    await writeQuoteAudit({
      profile,
      action: "quote.deleted",
      quoteId,
      reference,
      statusBefore: "draft",
      statusAfter: null,
    });

    return StaffDeleteQuoteResponseSchema.parse({ ok: true as const, id: String(quoteId) });
  }

  async send(profile: StaffProfileDocument, id: string): Promise<StaffSendQuoteResponse> {
    await connectMongo();
    const quote = await this.loadQuote(id);
    if (quote.status !== "draft") {
      throw new ConflictException({
        code: BILLING_QUOTES_ERROR_CODES.QUOTE_INVALID_STATUS,
        message: BILLING_QUOTES_ERROR_MESSAGES.QUOTE_INVALID_STATUS,
      });
    }

    const now = new Date();
    if (quote.validUntil.getTime() <= now.getTime()) {
      throw new BadRequestException({
        code: BILLING_QUOTES_ERROR_CODES.QUOTE_VALID_UNTIL_PAST,
        message: BILLING_QUOTES_ERROR_MESSAGES.QUOTE_VALID_UNTIL_PAST,
      });
    }

    if (!quote.lines?.length) {
      throw new BadRequestException({
        code: BILLING_QUOTES_ERROR_CODES.QUOTE_NO_LINES,
        message: BILLING_QUOTES_ERROR_MESSAGES.QUOTE_NO_LINES,
      });
    }

    if (!quote.cardexId) {
      const prospectParsed = QuoteSendProspectSchema.safeParse(quote.prospect ?? {});
      if (!prospectParsed.success) {
        throw new BadRequestException({
          code: BILLING_QUOTES_ERROR_CODES.QUOTE_PROSPECT_INCOMPLETE,
          message:
            prospectParsed.error.issues[0]?.message ??
            BILLING_QUOTES_ERROR_MESSAGES.QUOTE_PROSPECT_INCOMPLETE,
        });
      }
    }

    const env = parseGestionApiEnv();
    const tokenResult = await attachQuoteAcceptToken({
      quoteId: quote._id,
      tokenSecret: env.QUOTE_ACCEPT_TOKEN_SECRET,
      now,
    });

    const refreshed = await this.loadQuote(id);
    refreshed.status = "sent";
    refreshed.sentAt = now;
    refreshed.acceptTokenHash = tokenResult.tokenHash;
    refreshed.acceptTokenExpiresAt = tokenResult.expiresAt;
    await refreshed.save();

    const recipientEmail = await this.resolveRecipientEmail(refreshed);
    const acceptUrl = `${this.publicSiteBaseUrl()}/accepter-devis?token=${tokenResult.rawToken}`;
    let emailSent = false;

    const { pdf, html: quotePdfHtml } = await this.renderQuotePdfAttachment(refreshed, acceptUrl);

    if (recipientEmail) {
      const emailHtml = this.renderSendEmailHtml({
        reference: refreshed.reference,
        acceptUrl,
        validUntil: refreshed.validUntil,
      });
      // Defence in depth: staff-only note must never leak to client channels.
      if (refreshed.internalNote) {
        if (
          emailHtml.includes(refreshed.internalNote) ||
          quotePdfHtml.includes(refreshed.internalNote)
        ) {
          throw new BadRequestException({
            code: "INTERNAL_NOTE_LEAK",
            message: "La note interne ne peut pas être exposée au client.",
          });
        }
      }

      const mailResult = await this.mail.sendMail({
        to: recipientEmail,
        subject: `Votre devis ${refreshed.reference}`,
        html: emailHtml,
        attachments: [
          {
            filename: `${refreshed.reference}.pdf`,
            content: pdf,
            contentType: "application/pdf",
          },
        ],
      });
      const delivery = mailDeliveryFromResult(mailResult);
      emailSent = delivery.emailSent;

      const AuditLog = await getAuditLogModel();
      await AuditLog.create({
        actor: { kind: "staff", id: profile._id },
        action: "quote.sent",
        entity: { type: "quote", id: refreshed._id },
        diff: {
          status: { before: "draft", after: "sent" },
          ...emailDeliveryAuditDiff(delivery),
        },
        at: now,
      });
    } else {
      this.logger.warn(
        `quote.sent without recipient email quoteId=${String(refreshed._id)} ref=${refreshed.reference}`,
      );
      await writeQuoteAudit({
        profile,
        action: "quote.sent",
        quoteId: refreshed._id,
        reference: refreshed.reference,
        statusBefore: "draft",
        statusAfter: "sent",
        at: now,
      });
    }

    return StaffSendQuoteResponseSchema.parse({
      quote: this.mapQuote(refreshed),
      emailSent,
      acceptUrl,
    });
  }

  async downloadPdf(
    id: string,
  ): Promise<{ pdf: Buffer; filename: string; contentType: "application/pdf" }> {
    await connectMongo();
    const quote = await this.loadQuote(id);
    if (quote.status === "draft") {
      throw new ConflictException({
        code: BILLING_QUOTES_ERROR_CODES.QUOTE_INVALID_STATUS,
        message: BILLING_QUOTES_ERROR_MESSAGES.QUOTE_INVALID_STATUS,
      });
    }
    const acceptUrl = quote.acceptTokenExpiresAt
      ? `${this.publicSiteBaseUrl()}/accepter-devis`
      : `${this.publicSiteBaseUrl()}/accepter-devis`;
    // Staff download after send: token raw is not re-emitted; link without token still points to accept page.
    const { pdf } = await this.renderQuotePdfAttachment(quote, acceptUrl);
    return {
      pdf,
      filename: `${quote.reference}.pdf`,
      contentType: "application/pdf",
    };
  }

  async refuse(profile: StaffProfileDocument, id: string): Promise<StaffQuote> {
    await connectMongo();
    const quote = await this.loadQuote(id);
    if (quote.status !== "sent") {
      throw new ConflictException({
        code: BILLING_QUOTES_ERROR_CODES.QUOTE_INVALID_STATUS,
        message: BILLING_QUOTES_ERROR_MESSAGES.QUOTE_INVALID_STATUS,
      });
    }
    const before = quote.status;
    quote.status = "refused";
    quote.refusedAt = new Date();
    await quote.save();
    await writeQuoteAudit({
      profile,
      action: "quote.refused",
      quoteId: quote._id,
      reference: quote.reference,
      statusBefore: before,
      statusAfter: "refused",
    });
    return this.mapQuote(quote);
  }

  async expire(profile: StaffProfileDocument, id: string): Promise<StaffQuote> {
    await connectMongo();
    const quote = await this.loadQuote(id);
    if (quote.status !== "sent") {
      throw new ConflictException({
        code: BILLING_QUOTES_ERROR_CODES.QUOTE_INVALID_STATUS,
        message: BILLING_QUOTES_ERROR_MESSAGES.QUOTE_INVALID_STATUS,
      });
    }
    const before = quote.status;
    quote.status = "expired";
    quote.expiredAt = new Date();
    await quote.save();
    await writeQuoteAudit({
      profile,
      action: "quote.expired",
      quoteId: quote._id,
      reference: quote.reference,
      statusBefore: before,
      statusAfter: "expired",
    });
    return this.mapQuote(quote);
  }

  /**
   * Staff oral « Devis accepté » — calls the same domain `acceptQuote` as the
   * vitrine client path (§5.1.4).
   */
  async accept(profile: StaffProfileDocument, id: string): Promise<StaffAcceptQuoteResponse> {
    await connectMongo();
    const quote = await this.loadQuote(id);
    if (quote.status !== "sent") {
      throw new ConflictException({
        code: BILLING_QUOTES_ERROR_CODES.QUOTE_INVALID_STATUS,
        message: BILLING_QUOTES_ERROR_MESSAGES.QUOTE_INVALID_STATUS,
      });
    }

    const env = parseGestionApiEnv();
    const lockSessionId = buildStaffQuoteLockSessionId(String(profile._id), String(quote._id));

    let result: Awaited<ReturnType<typeof acceptQuote>>;
    try {
      result = await acceptQuote({
        quoteId: quote._id,
        actor: {
          kind: "staff",
          staffProfileId: profile._id,
          activationTokenSecret: env.CLIENT_ACCOUNT_ACTIVATION_TOKEN_SECRET,
        },
        lockSessionId,
        paymentLinkTokenSecret: env.QUOTE_PAYMENT_LINK_TOKEN_SECRET,
      });
    } catch (error) {
      this.rethrowAcceptError(error);
    }

    let activationEmailSent = false;
    if (result.activation && result.bootstrapped) {
      const recipient =
        quote.prospect?.email?.trim().toLowerCase() ??
        (await this.resolveRecipientEmail(await this.loadQuote(id)));
      if (recipient) {
        const activationUrl = `${this.publicSiteBaseUrl()}/activer-compte?token=${result.activation.rawToken}`;
        const mailResult = await this.mail.sendMail({
          to: recipient,
          subject: `Définir votre mot de passe — devis ${result.reference}`,
          html: this.renderActivationEmailHtml({
            reference: result.reference,
            activationUrl,
          }),
        });
        activationEmailSent = mailDeliveryFromResult(mailResult).emailSent;
      }
    }

    let paymentUrl: string | undefined;
    let paymentEmailSent = false;
    if (result.paymentLink) {
      paymentUrl = `${this.publicSiteBaseUrl()}/payer-devis?token=${result.paymentLink.rawToken}&invoiceId=${String(result.invoiceId)}`;
      paymentEmailSent = await this.sendQuotePaymentLinkEmail({
        quote,
        invoiceReference: result.invoiceReference,
        paymentUrl,
        amountDueCents: result.paymentLink.amountDueCents,
        expiresAt: result.paymentLink.expiresAt,
      });
    }

    await writeQuoteAudit({
      profile,
      action: "quote.accepted",
      quoteId: result.quoteId,
      reference: result.reference,
      statusBefore: "sent",
      statusAfter: "accepted",
      extraDiff: {
        acceptedBy: { before: null, after: "staff" },
        reservationIds: {
          before: [],
          after: result.reservationIds.map(String),
        },
        invoiceReference: { before: null, after: result.invoiceReference },
        bootstrapped: { before: false, after: result.bootstrapped },
        ...(paymentUrl ? { paymentLink: { before: null, after: "issued" } } : {}),
      },
    });

    const accepted = await this.loadQuote(id);
    return StaffAcceptQuoteResponseSchema.parse({
      quote: this.mapQuote(accepted),
      reservationIds: result.reservationIds.map(String),
      invoiceId: String(result.invoiceId),
      invoiceReference: result.invoiceReference,
      cardexId: String(result.cardexId),
      clientAccountId: String(result.clientAccountId),
      bootstrapped: result.bootstrapped,
      activationEmailSent,
      ...(paymentUrl ? { paymentUrl, paymentEmailSent } : {}),
    });
  }

  private rethrowAcceptError(error: unknown): never {
    if (error instanceof AcceptQuoteError) {
      const map: Record<
        AcceptQuoteError["code"],
        { status: "conflict" | "bad" | "notfound"; code: string; message: string }
      > = {
        QUOTE_NOT_FOUND: {
          status: "notfound",
          code: BILLING_QUOTES_ERROR_CODES.QUOTE_NOT_FOUND,
          message: BILLING_QUOTES_ERROR_MESSAGES.QUOTE_NOT_FOUND,
        },
        QUOTE_INVALID_STATUS: {
          status: "conflict",
          code: BILLING_QUOTES_ERROR_CODES.QUOTE_INVALID_STATUS,
          message: BILLING_QUOTES_ERROR_MESSAGES.QUOTE_INVALID_STATUS,
        },
        QUOTE_EXPIRED: {
          status: "conflict",
          code: BILLING_QUOTES_ERROR_CODES.QUOTE_EXPIRED,
          message: BILLING_QUOTES_ERROR_MESSAGES.QUOTE_EXPIRED,
        },
        QUOTE_NO_SPACE_LINES: {
          status: "bad",
          code: BILLING_QUOTES_ERROR_CODES.QUOTE_NO_SPACE_LINES,
          message: BILLING_QUOTES_ERROR_MESSAGES.QUOTE_NO_SPACE_LINES,
        },
        SLOT_UNAVAILABLE: {
          status: "conflict",
          code: BILLING_QUOTES_ERROR_CODES.QUOTE_SLOT_UNAVAILABLE,
          message: error.message || BILLING_QUOTES_ERROR_MESSAGES.QUOTE_SLOT_UNAVAILABLE,
        },
        PROSPECT_REQUIRED: {
          status: "bad",
          code: BILLING_QUOTES_ERROR_CODES.QUOTE_PROSPECT_INCOMPLETE,
          message: error.message,
        },
        PROSPECT_IDENTITY_INCOMPLETE: {
          status: "bad",
          code: BILLING_QUOTES_ERROR_CODES.QUOTE_PROSPECT_INCOMPLETE,
          message: BILLING_QUOTES_ERROR_MESSAGES.QUOTE_PROSPECT_INCOMPLETE,
        },
        ACCOUNT_REQUIRED: {
          status: "bad",
          code: BILLING_QUOTES_ERROR_CODES.VALIDATION_ERROR,
          message: error.message,
        },
        ACCOUNT_INVALID: {
          status: "bad",
          code: BILLING_QUOTES_ERROR_CODES.VALIDATION_ERROR,
          message: error.message,
        },
        ACCOUNT_ALREADY_EXISTS: {
          status: "conflict",
          code: BILLING_QUOTES_ERROR_CODES.VALIDATION_ERROR,
          message: error.message,
        },
        SPACE_NOT_FOUND: {
          status: "bad",
          code: BILLING_QUOTES_ERROR_CODES.VALIDATION_ERROR,
          message: error.message,
        },
      };
      const mapped = map[error.code];
      const body = { code: mapped.code, message: mapped.message };
      if (mapped.status === "notfound") throw new NotFoundException(body);
      if (mapped.status === "bad") throw new BadRequestException(body);
      throw new ConflictException(body);
    }
    throw error;
  }

  private renderActivationEmailHtml(input: { reference: string; activationUrl: string }): string {
    const siteUrl = resolvePublicSiteUrl();
    const ref = escapeEmailHtml(input.reference);
    const url = escapeEmailHtml(input.activationUrl);
    const body = `
      <p style="margin-top:0;">Votre devis <strong>${ref}</strong> a été accepté.</p>
      <p>Pour accéder à votre espace client, définissez votre mot de passe&nbsp;:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;">
        ${emailDetailRow("Lien d'activation", `<a href="${url}">${url}</a>`, { last: true })}
      </table>
      <p style="margin:16px 0 0;font-size:13px;color:#555;">
        Tant que le mot de passe n'est pas défini, la connexion reste bloquée
        (compte en attente d'activation).
      </p>
    `;
    return renderCoworkEmailLayout("Définir votre mot de passe", body, siteUrl);
  }

  private async loadQuote(id: string): Promise<QuoteDocument> {
    const quoteId = assertObjectId(id, "quoteId");
    const QuoteModel = await getQuoteModel();
    const quote = await QuoteModel.findById(quoteId).exec();
    if (!quote) {
      throw new NotFoundException({
        code: BILLING_QUOTES_ERROR_CODES.QUOTE_NOT_FOUND,
        message: BILLING_QUOTES_ERROR_MESSAGES.QUOTE_NOT_FOUND,
      });
    }
    return quote;
  }

  private buildPricedLines(
    lines: StaffQuoteLineInput[],
    staffProfileId: string,
    depositPercent: number,
  ) {
    const recomputed = recomputeQuotePricing({
      lines: lines.map((line) => ({
        calculatedUnitPriceHT: line.calculatedUnitPriceHT,
        qty: line.qty,
        vatRate: line.vatRate,
        discount: line.discount,
        forcedUnitPriceHT: line.forcedUnitPriceHT,
        priceSource: line.priceSource,
      })),
      depositPercent,
    });

    const now = new Date();
    const mergedLines = lines.map((line, index) => {
      const priced = recomputed.lines[index]!;
      const isForced = priced.priceSource === "forced";
      return {
        lineId: line.lineId,
        kind: line.kind,
        label: line.label,
        ...(line.spaceId ? { spaceId: line.spaceId } : {}),
        ...(line.buildingId ? { buildingId: line.buildingId } : {}),
        ...(line.startAt ? { startAt: new Date(line.startAt) } : {}),
        ...(line.endAt ? { endAt: new Date(line.endAt) } : {}),
        ...(line.partySize !== undefined ? { partySize: line.partySize } : {}),
        ...(line.durationClass ? { durationClass: line.durationClass } : {}),
        ...(line.units !== undefined ? { units: line.units } : {}),
        calculatedUnitPriceHT: priced.calculatedUnitPriceHT,
        calculatedTotalHT: priced.calculatedTotalHT,
        calculatedTotalVAT: priced.calculatedTotalVAT,
        calculatedTotalTTC: priced.calculatedTotalTTC,
        ...(priced.forcedUnitPriceHT !== undefined
          ? { forcedUnitPriceHT: priced.forcedUnitPriceHT }
          : {}),
        unitPriceHT: priced.unitPriceHT,
        qty: priced.qty,
        vatRate: priced.vatRate,
        discount: priced.discount,
        totalHT: priced.totalHT,
        totalVAT: priced.totalVAT,
        totalTTC: priced.totalTTC,
        priceSource: priced.priceSource,
        ...(isForced && line.priceOverrideReason
          ? {
              priceOverrideReason: line.priceOverrideReason,
              priceOverriddenByStaffProfileId: staffProfileId,
              priceOverriddenAt: now,
            }
          : {}),
      };
    });

    return {
      lines: mergedLines,
      vatBreakdown: recomputed.vatBreakdown,
      totals: recomputed.totals,
      deposit: recomputed.deposit,
    };
  }

  private linesToInput(quote: QuoteDocument): StaffQuoteLineInput[] {
    return quote.lines.map((line) => ({
      lineId: line.lineId,
      kind: line.kind as StaffQuoteLineInput["kind"],
      label: line.label,
      ...(line.spaceId ? { spaceId: String(line.spaceId) } : {}),
      ...(line.buildingId ? { buildingId: String(line.buildingId) } : {}),
      ...(line.startAt ? { startAt: toIso(line.startAt)! } : {}),
      ...(line.endAt ? { endAt: toIso(line.endAt)! } : {}),
      ...(line.partySize !== undefined ? { partySize: line.partySize } : {}),
      ...(line.durationClass
        ? { durationClass: line.durationClass as StaffQuoteLineInput["durationClass"] }
        : {}),
      ...(line.units !== undefined ? { units: line.units } : {}),
      calculatedUnitPriceHT: line.calculatedUnitPriceHT,
      qty: line.qty,
      vatRate: line.vatRate,
      discount: line.discount,
      ...(line.forcedUnitPriceHT !== undefined
        ? { forcedUnitPriceHT: line.forcedUnitPriceHT }
        : {}),
      priceSource: line.priceSource,
      ...(line.priceOverrideReason ? { priceOverrideReason: line.priceOverrideReason } : {}),
    }));
  }

  private resolveClientDisplay(
    quote: StaffQuote,
    cardex?: {
      identity?: { firstName?: string; lastName?: string };
      company?: { legalName?: string };
    } | null,
  ): { clientLabel: string; companyLegalName: string | null } {
    const prospect = quote.prospect;
    const fromProspect =
      prospect?.displayName?.trim() ||
      [prospect?.firstName, prospect?.lastName]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(" ");
    const fromCardex = [cardex?.identity?.firstName, cardex?.identity?.lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ");
    const clientLabel = fromProspect || fromCardex || prospect?.email?.trim() || "—";
    const companyLegalName =
      prospect?.companyName?.trim() || cardex?.company?.legalName?.trim() || null;
    return { clientLabel, companyLegalName };
  }

  private mapQuote(doc: Quote & { _id: Types.ObjectId }): StaffQuote {
    return StaffQuoteSchema.parse({
      id: String(doc._id),
      reference: doc.reference,
      currency: doc.currency,
      status: doc.status,
      ...(doc.cardexId ? { cardexId: String(doc.cardexId) } : {}),
      ...(doc.clientAccountId ? { clientAccountId: String(doc.clientAccountId) } : {}),
      ...(doc.prospect ? { prospect: doc.prospect } : {}),
      lines: (doc.lines ?? []).map((line) => ({
        lineId: line.lineId,
        kind: line.kind,
        label: line.label,
        ...(line.spaceId ? { spaceId: String(line.spaceId) } : {}),
        ...(line.buildingId ? { buildingId: String(line.buildingId) } : {}),
        ...(line.startAt ? { startAt: toIso(line.startAt) } : {}),
        ...(line.endAt ? { endAt: toIso(line.endAt) } : {}),
        ...(line.partySize !== undefined ? { partySize: line.partySize } : {}),
        ...(line.durationClass ? { durationClass: line.durationClass } : {}),
        ...(line.units !== undefined ? { units: line.units } : {}),
        calculatedUnitPriceHT: line.calculatedUnitPriceHT,
        calculatedTotalHT: line.calculatedTotalHT,
        calculatedTotalVAT: line.calculatedTotalVAT,
        calculatedTotalTTC: line.calculatedTotalTTC,
        ...(line.forcedUnitPriceHT !== undefined
          ? { forcedUnitPriceHT: line.forcedUnitPriceHT }
          : {}),
        unitPriceHT: line.unitPriceHT,
        qty: line.qty,
        vatRate: line.vatRate,
        discount: line.discount ?? 0,
        totalHT: line.totalHT,
        totalVAT: line.totalVAT,
        totalTTC: line.totalTTC,
        priceSource: line.priceSource,
        ...(line.priceOverrideReason ? { priceOverrideReason: line.priceOverrideReason } : {}),
        ...(line.priceOverriddenByStaffProfileId
          ? { priceOverriddenByStaffProfileId: String(line.priceOverriddenByStaffProfileId) }
          : {}),
        ...(line.priceOverriddenAt ? { priceOverriddenAt: toIso(line.priceOverriddenAt) } : {}),
      })),
      vatBreakdown: doc.vatBreakdown ?? [],
      totals: doc.totals,
      depositPercent: doc.depositPercent,
      ...(doc.depositAmountHT !== undefined ? { depositAmountHT: doc.depositAmountHT } : {}),
      ...(doc.depositAmountTTC !== undefined ? { depositAmountTTC: doc.depositAmountTTC } : {}),
      ...(doc.depositVatBreakdown?.length ? { depositVatBreakdown: doc.depositVatBreakdown } : {}),
      ...(doc.paymentSituation ? { paymentSituation: doc.paymentSituation } : {}),
      ...(doc.paymentMethodPreferred ? { paymentMethodPreferred: doc.paymentMethodPreferred } : {}),
      validUntil: toIso(doc.validUntil)!,
      ...(doc.internalNote ? { internalNote: doc.internalNote } : {}),
      ...(doc.publicConditions ? { publicConditions: doc.publicConditions } : {}),
      ...(doc.paymentTermsLabel ? { paymentTermsLabel: doc.paymentTermsLabel } : {}),
      reservationIds: (doc.reservationIds ?? []).map((rid) => String(rid)),
      ...(doc.sentAt ? { sentAt: toIso(doc.sentAt) } : {}),
      ...(doc.acceptedAt ? { acceptedAt: toIso(doc.acceptedAt) } : {}),
      ...(doc.refusedAt ? { refusedAt: toIso(doc.refusedAt) } : {}),
      ...(doc.expiredAt ? { expiredAt: toIso(doc.expiredAt) } : {}),
      ...(doc.acceptedBy
        ? {
            acceptedBy: {
              kind: doc.acceptedBy.kind,
              ...(doc.acceptedBy.clientAccountId
                ? { clientAccountId: String(doc.acceptedBy.clientAccountId) }
                : {}),
              ...(doc.acceptedBy.staffProfileId
                ? { staffProfileId: String(doc.acceptedBy.staffProfileId) }
                : {}),
              ...(doc.acceptedBy.ipAddress ? { ipAddress: doc.acceptedBy.ipAddress } : {}),
            },
          }
        : {}),
      ...(doc.createdByStaffProfileId
        ? { createdByStaffProfileId: String(doc.createdByStaffProfileId) }
        : {}),
      ...(doc.acceptTokenExpiresAt
        ? { acceptTokenExpiresAt: toIso(doc.acceptTokenExpiresAt) }
        : {}),
      createdAt: toIso(doc.createdAt)!,
      updatedAt: toIso(doc.updatedAt)!,
    });
  }

  private async resolveRecipientEmail(quote: QuoteDocument): Promise<string | null> {
    if (quote.prospect?.email) {
      return quote.prospect.email.trim().toLowerCase();
    }
    if (quote.clientAccountId) {
      const ClientAccount = await getClientAccountModel();
      const account = await ClientAccount.findById(quote.clientAccountId)
        .select({ email: 1 })
        .lean()
        .exec();
      if (account?.email) return account.email.trim().toLowerCase();
    }
    if (quote.cardexId) {
      const Cardex = await getCardexModel();
      const cardex = await Cardex.findById(quote.cardexId)
        .select({ clientAccountId: 1 })
        .lean()
        .exec();
      if (cardex?.clientAccountId) {
        const ClientAccount = await getClientAccountModel();
        const account = await ClientAccount.findById(cardex.clientAccountId)
          .select({ email: 1 })
          .lean()
          .exec();
        if (account?.email) return account.email.trim().toLowerCase();
      }
    }
    return null;
  }

  private async renderQuotePdfAttachment(
    quote: QuoteDocument,
    acceptUrl: string,
  ): Promise<{ pdf: Buffer; html: string }> {
    const issuer = loadInvoiceIssuerConfig();
    if (!issuer) {
      throw new BadRequestException({
        code: "INVOICE_ISSUER_NOT_CONFIGURED",
        message:
          "Identité émetteur incomplete — renseignez les variables INVOICE_ISSUER_* dans l’environnement",
      });
    }

    let cardex: QuotePdfSourceCardex | null = null;

    if (quote.cardexId) {
      const Cardex = await getCardexModel();
      const doc = await Cardex.findById(quote.cardexId).lean().exec();
      if (doc) {
        cardex = {
          identity: doc.identity,
          address: doc.address,
          company: doc.company,
        };
      }
    }

    const model = buildQuotePdfViewModel({
      quote: {
        reference: quote.reference,
        issuedAt: quote.sentAt ?? quote.createdAt,
        validUntil: quote.validUntil,
        lines: (quote.lines ?? []).map((line) => ({
          label: line.label,
          kind: line.kind,
          qty: line.qty,
          unitPriceHT: line.unitPriceHT,
          vatRate: line.vatRate,
          discount: line.discount,
          totalHT: line.totalHT,
          startAt: line.startAt,
          endAt: line.endAt,
        })),
        vatBreakdown: quote.vatBreakdown ?? [],
        totals: {
          ht: quote.totals.ht,
          vat: quote.totals.vat,
          ttc: quote.totals.ttc,
          discountTotal: quote.totals.discountTotal ?? 0,
        },
        depositPercent: quote.depositPercent,
        depositAmountTTC: quote.depositAmountTTC,
        paymentMethodPreferred: quote.paymentMethodPreferred,
        paymentTermsLabel: quote.paymentTermsLabel,
        publicConditions: quote.publicConditions,
        // Passed only so mapper can prove it ignores it — never mapped to view model.
        internalNote: quote.internalNote,
        prospect: quote.prospect,
      },
      issuer,
      logoDataUri: loadInvoiceLogoDataUri(),
      acceptUrl,
      cardex,
      bankRib: quote.paymentMethodPreferred === "bank_transfer" ? loadInvoicePdfBankRib() : null,
    });

    return this.invoicePdf.generatePdfForQuoteViewModel(model);
  }

  private publicSiteBaseUrl(): string {
    const fromEnv = process.env.PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (fromEnv) return fromEnv.replace(/\/$/, "");
    return "http://localhost:3001";
  }

  private async sendQuotePaymentLinkEmail(input: {
    quote: QuoteDocument;
    invoiceReference: string;
    paymentUrl: string;
    amountDueCents: number;
    expiresAt: Date;
  }): Promise<boolean> {
    const recipient =
      input.quote.prospect?.email?.trim().toLowerCase() ??
      (await this.resolveRecipientEmail(input.quote));
    if (!recipient) {
      this.logger.warn(
        `quote.accepted payment email skipped — no recipient for ${input.quote.reference}`,
      );
      return false;
    }

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
      subject: `Payer votre réservation — devis ${input.quote.reference}`,
      html: [
        `<p>Bonjour,</p>`,
        `<p>Votre devis <strong>${escapeEmailHtml(input.quote.reference)}</strong> a été accepté.</p>`,
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
    return mailDeliveryFromResult(mailResult).emailSent;
  }

  private renderSendEmailHtml(input: {
    reference: string;
    acceptUrl: string;
    validUntil: Date;
  }): string {
    const validUntilLabel = input.validUntil.toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
    });
    return [
      `<p>Bonjour,</p>`,
      `<p>Votre devis <strong>${input.reference}</strong> est disponible (PDF en pièce jointe).</p>`,
      `<p>Valable jusqu'au ${validUntilLabel}.</p>`,
      `<p><a href="${input.acceptUrl}">Accepter le devis</a></p>`,
      `<p>Cordialement,<br/>Cowork Prysme</p>`,
    ].join("\n");
  }
}
