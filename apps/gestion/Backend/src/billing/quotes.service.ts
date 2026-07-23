import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  assertReplicaSetForTransactions,
  attachQuoteAcceptToken,
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
  BILLING_QUOTES_ERROR_CODES,
  BILLING_QUOTES_ERROR_MESSAGES,
  QuoteSendProspectSchema,
  StaffDeleteQuoteResponseSchema,
  StaffQuoteListResponseSchema,
  StaffQuoteSchema,
  StaffSendQuoteResponseSchema,
  recomputeQuotePricing,
  type StaffCreateQuoteRequest,
  type StaffQuote,
  type StaffQuoteLineInput,
  type StaffQuoteListQuery,
  type StaffQuoteListResponse,
  type StaffSendQuoteResponse,
  type StaffUpdateQuoteRequest,
} from "@coworkprysme/shared";
import { parseGestionApiEnv } from "@coworkprysme/shared/server";
import type { Types } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
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

  constructor(private readonly mail: MailService) {}

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
      filter.$or = [
        { reference: { $regex: q, $options: "i" } },
        { "prospect.email": { $regex: q, $options: "i" } },
        { "prospect.displayName": { $regex: q, $options: "i" } },
        { "prospect.companyName": { $regex: q, $options: "i" } },
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

    return StaffQuoteListResponseSchema.parse({
      quotes: rows.map((row) => {
        const mapped = this.mapQuote(row as Quote & { _id: Types.ObjectId });
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
        };
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async getById(id: string): Promise<StaffQuote> {
    const quote = await this.loadQuote(id);
    return this.mapQuote(quote);
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

    if (recipientEmail) {
      const mailResult = await this.mail.sendMail({
        to: recipientEmail,
        subject: `Votre devis ${refreshed.reference}`,
        html: this.renderSendEmailHtml({
          reference: refreshed.reference,
          acceptUrl,
          validUntil: refreshed.validUntil,
        }),
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

  private publicSiteBaseUrl(): string {
    const fromEnv = process.env.PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (fromEnv) return fromEnv.replace(/\/$/, "");
    return "http://localhost:3001";
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
      `<p>Votre devis <strong>${input.reference}</strong> est disponible.</p>`,
      `<p>Valable jusqu'au ${validUntilLabel}.</p>`,
      `<p><a href="${input.acceptUrl}">Accepter le devis</a></p>`,
      `<p>Cordialement,<br/>Cowork Prysme</p>`,
    ].join("\n");
  }
}
