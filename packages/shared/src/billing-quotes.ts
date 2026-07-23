import { z } from "zod";

import { SpaceDurationClassSchema } from "./spaces.js";

/** Mirrors packages/db QUOTE_STATUSES (keep in sync). */
export const QuoteStatusSchema = z.enum(["draft", "sent", "accepted", "refused", "expired"]);
export type QuoteStatus = z.infer<typeof QuoteStatusSchema>;

/** Mirrors packages/db QUOTE_PAYMENT_METHODS (keep in sync). */
export const QuotePaymentMethodSchema = z.enum(["card", "bank_transfer", "direct_debit"]);
export type QuotePaymentMethod = z.infer<typeof QuotePaymentMethodSchema>;

/** Mirrors packages/db QUOTE_LINE_PRICE_SOURCES (keep in sync). */
export const QuoteLinePriceSourceSchema = z.enum(["auto", "forced"]);
export type QuoteLinePriceSource = z.infer<typeof QuoteLinePriceSourceSchema>;

/** Mirrors packages/db QUOTE_ACCEPTED_BY_KINDS (keep in sync). */
export const QuoteAcceptedByKindSchema = z.enum(["client", "staff"]);
export type QuoteAcceptedByKind = z.infer<typeof QuoteAcceptedByKindSchema>;

/** Mirrors packages/db BILLING_LINE_KINDS (keep in sync). */
export const BillingLineKindSchema = z.enum(["space", "service", "fee", "discount", "other"]);
export type BillingLineKind = z.infer<typeof BillingLineKindSchema>;

/** Mirrors packages/db PAYMENT_SITUATIONS (keep in sync). */
export const QuotePaymentSituationSchema = z.enum(["immediate", "on_quote", "deposit", "net_30"]);
export type QuotePaymentSituation = z.infer<typeof QuotePaymentSituationSchema>;

const optionalTrimmed = z.string().trim().min(1).optional();
const optionalObjectId = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, "Identifiant invalide")
  .optional();

export const QuoteProspectBillingAddressSchema = z.object({
  street: z.string().trim().min(1),
  zip: z.string().trim().min(1),
  city: z.string().trim().min(1),
  country: z.string().trim().min(1).default("FR"),
  accessInfo: optionalTrimmed,
});
export type QuoteProspectBillingAddress = z.infer<typeof QuoteProspectBillingAddressSchema>;

/** Prospect / clientDraft identity before cardex (draft may be email-only). */
export const QuoteProspectSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  firstName: optionalTrimmed,
  lastName: optionalTrimmed,
  displayName: optionalTrimmed,
  phone: optionalTrimmed,
  companyName: optionalTrimmed,
  billingAddress: QuoteProspectBillingAddressSchema.optional(),
});
export type QuoteProspect = z.infer<typeof QuoteProspectSchema>;

/**
 * Prospect required to **send** a quote without cardex (LOCKED product a):
 * email + `(firstName AND lastName) OR displayName` — not email alone.
 * Aligns with `resolveProspectIdentity` (packages/db bootstrap).
 */
export const QuoteSendProspectSchema = QuoteProspectSchema.superRefine((prospect, context) => {
  const hasNames = Boolean(prospect.firstName && prospect.lastName);
  const hasDisplay = Boolean(prospect.displayName);
  if (!hasNames && !hasDisplay) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["displayName"],
      message:
        "Le prospect doit avoir un prénom et un nom, ou un nom d'affichage, pour l'envoi du devis.",
    });
  }
});
export type QuoteSendProspect = z.infer<typeof QuoteSendProspectSchema>;

export const QuoteDepositPercentSchema = z.number().int().min(0).max(100);

/** Max accept-token lifetime from issue time (LOCKED product b). */
export const QUOTE_ACCEPT_TOKEN_MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * `acceptTokenExpiresAt = min(validUntil, now + 30 days)`.
 */
export function resolveQuoteAcceptTokenExpiresAt(validUntil: Date, now: Date = new Date()): Date {
  const capped = now.getTime() + QUOTE_ACCEPT_TOKEN_MAX_TTL_MS;
  return new Date(Math.min(validUntil.getTime(), capped));
}

export const BILLING_QUOTES_ERROR_CODES = {
  QUOTE_NOT_FOUND: "QUOTE_NOT_FOUND",
  QUOTE_NOT_DRAFT: "QUOTE_NOT_DRAFT",
  QUOTE_INVALID_STATUS: "QUOTE_INVALID_STATUS",
  QUOTE_PROSPECT_INCOMPLETE: "QUOTE_PROSPECT_INCOMPLETE",
  QUOTE_NO_LINES: "QUOTE_NO_LINES",
  QUOTE_VALID_UNTIL_PAST: "QUOTE_VALID_UNTIL_PAST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_ID: "INVALID_ID",
} as const;

export type BillingQuotesErrorCode =
  (typeof BILLING_QUOTES_ERROR_CODES)[keyof typeof BILLING_QUOTES_ERROR_CODES];

export const BILLING_QUOTES_ERROR_MESSAGES = {
  QUOTE_NOT_FOUND: "Devis introuvable.",
  QUOTE_NOT_DRAFT: "Seul un devis en brouillon peut être modifié ou supprimé.",
  QUOTE_INVALID_STATUS: "Transition de statut non autorisée pour ce devis.",
  QUOTE_PROSPECT_INCOMPLETE:
    "Le prospect doit avoir un prénom et un nom, ou un nom d'affichage, pour l'envoi du devis.",
  QUOTE_NO_LINES: "Le devis doit contenir au moins une ligne pour être envoyé.",
  QUOTE_VALID_UNTIL_PAST: "La date de validité du devis est déjà dépassée.",
  INVALID_ID: "Identifiant invalide.",
} as const;

const centsNonNeg = z.number().int().min(0);

/** Input line for create/patch — server recomputes effective totals via `recomputeQuotePricing`. */
export const StaffQuoteLineInputSchema = z
  .object({
    lineId: z.string().trim().min(1).max(64),
    kind: BillingLineKindSchema,
    label: z.string().trim().min(1).max(500),
    spaceId: optionalObjectId,
    buildingId: optionalObjectId,
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    partySize: z.number().int().min(1).optional(),
    durationClass: SpaceDurationClassSchema.optional(),
    units: z.number().min(0).optional(),
    calculatedUnitPriceHT: centsNonNeg,
    qty: z.number().min(0),
    vatRate: z.number().min(0),
    discount: centsNonNeg.optional(),
    forcedUnitPriceHT: centsNonNeg.optional(),
    priceSource: QuoteLinePriceSourceSchema.optional(),
    priceOverrideReason: z.string().trim().min(1).max(1000).optional(),
  })
  .superRefine((line, context) => {
    const forced =
      line.priceSource === "forced" ||
      (line.forcedUnitPriceHT !== undefined && line.priceSource !== "auto");
    if (forced && !line.priceOverrideReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceOverrideReason"],
        message: "Une justification est requise pour un prix forcé.",
      });
    }
    if (forced && line.forcedUnitPriceHT === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["forcedUnitPriceHT"],
        message: "forcedUnitPriceHT est requis lorsque le prix est forcé.",
      });
    }
  });
export type StaffQuoteLineInput = z.infer<typeof StaffQuoteLineInputSchema>;

export const StaffQuoteVatBreakdownLineSchema = z.object({
  rate: z.number(),
  baseHT: z.number().int(),
  vat: z.number().int(),
});
export type StaffQuoteVatBreakdownLine = z.infer<typeof StaffQuoteVatBreakdownLineSchema>;

export const StaffQuoteTotalsSchema = z.object({
  ht: z.number().int(),
  vat: z.number().int(),
  ttc: z.number().int(),
  discountTotal: z.number().int().min(0),
});
export type StaffQuoteTotals = z.infer<typeof StaffQuoteTotalsSchema>;

export const StaffQuoteLineSchema = z.object({
  lineId: z.string(),
  kind: BillingLineKindSchema,
  label: z.string(),
  spaceId: z.string().optional(),
  buildingId: z.string().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  partySize: z.number().int().optional(),
  durationClass: SpaceDurationClassSchema.optional(),
  units: z.number().optional(),
  calculatedUnitPriceHT: z.number().int(),
  calculatedTotalHT: z.number().int(),
  calculatedTotalVAT: z.number().int(),
  calculatedTotalTTC: z.number().int(),
  forcedUnitPriceHT: z.number().int().optional(),
  unitPriceHT: z.number().int(),
  qty: z.number(),
  vatRate: z.number(),
  discount: z.number().int(),
  totalHT: z.number().int(),
  totalVAT: z.number().int(),
  totalTTC: z.number().int(),
  priceSource: QuoteLinePriceSourceSchema,
  priceOverrideReason: z.string().optional(),
  priceOverriddenByStaffProfileId: z.string().optional(),
  priceOverriddenAt: z.string().datetime().optional(),
});
export type StaffQuoteLine = z.infer<typeof StaffQuoteLineSchema>;

export const StaffQuoteSchema = z.object({
  id: z.string(),
  reference: z.string(),
  currency: z.string(),
  status: QuoteStatusSchema,
  cardexId: z.string().optional(),
  clientAccountId: z.string().optional(),
  prospect: QuoteProspectSchema.optional(),
  lines: z.array(StaffQuoteLineSchema),
  vatBreakdown: z.array(StaffQuoteVatBreakdownLineSchema),
  totals: StaffQuoteTotalsSchema,
  depositPercent: QuoteDepositPercentSchema,
  depositAmountHT: z.number().int().optional(),
  depositAmountTTC: z.number().int().optional(),
  depositVatBreakdown: z.array(StaffQuoteVatBreakdownLineSchema).optional(),
  paymentSituation: QuotePaymentSituationSchema.optional(),
  paymentMethodPreferred: QuotePaymentMethodSchema.optional(),
  validUntil: z.string().datetime(),
  internalNote: z.string().optional(),
  publicConditions: z.string().optional(),
  paymentTermsLabel: z.string().optional(),
  reservationIds: z.array(z.string()),
  sentAt: z.string().datetime().optional(),
  acceptedAt: z.string().datetime().optional(),
  refusedAt: z.string().datetime().optional(),
  expiredAt: z.string().datetime().optional(),
  createdByStaffProfileId: z.string().optional(),
  acceptTokenExpiresAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type StaffQuote = z.infer<typeof StaffQuoteSchema>;

export const StaffQuoteListItemSchema = StaffQuoteSchema.pick({
  id: true,
  reference: true,
  status: true,
  cardexId: true,
  clientAccountId: true,
  prospect: true,
  totals: true,
  depositPercent: true,
  depositAmountTTC: true,
  paymentMethodPreferred: true,
  validUntil: true,
  sentAt: true,
  createdAt: true,
  updatedAt: true,
});
export type StaffQuoteListItem = z.infer<typeof StaffQuoteListItemSchema>;

export const StaffQuoteListResponseSchema = z.object({
  quotes: z.array(StaffQuoteListItemSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type StaffQuoteListResponse = z.infer<typeof StaffQuoteListResponseSchema>;

export const StaffCreateQuoteRequestSchema = z.object({
  cardexId: optionalObjectId,
  clientAccountId: optionalObjectId,
  prospect: QuoteProspectSchema.optional(),
  lines: z.array(StaffQuoteLineInputSchema).default([]),
  depositPercent: QuoteDepositPercentSchema.default(0),
  paymentSituation: QuotePaymentSituationSchema.optional(),
  paymentMethodPreferred: QuotePaymentMethodSchema.optional(),
  validUntil: z.string().datetime(),
  internalNote: z.string().trim().max(5000).optional(),
  publicConditions: z.string().trim().max(10000).optional(),
  paymentTermsLabel: z.string().trim().max(500).optional(),
});
export type StaffCreateQuoteRequest = z.infer<typeof StaffCreateQuoteRequestSchema>;

/** Full draft update. Sent quotes accept only `internalNote` (enforced in service). */
export const StaffUpdateQuoteRequestSchema = z.object({
  cardexId: z.union([z.string().regex(/^[a-f0-9]{24}$/i), z.null()]).optional(),
  clientAccountId: z.union([z.string().regex(/^[a-f0-9]{24}$/i), z.null()]).optional(),
  prospect: QuoteProspectSchema.nullable().optional(),
  lines: z.array(StaffQuoteLineInputSchema).optional(),
  depositPercent: QuoteDepositPercentSchema.optional(),
  paymentSituation: QuotePaymentSituationSchema.optional(),
  paymentMethodPreferred: QuotePaymentMethodSchema.optional(),
  validUntil: z.string().datetime().optional(),
  internalNote: z.string().trim().max(5000).nullable().optional(),
  publicConditions: z.string().trim().max(10000).nullable().optional(),
  paymentTermsLabel: z.string().trim().max(500).nullable().optional(),
});
export type StaffUpdateQuoteRequest = z.infer<typeof StaffUpdateQuoteRequestSchema>;

export const StaffQuoteListQuerySchema = z.object({
  status: QuoteStatusSchema.optional(),
  cardexId: z
    .string()
    .regex(/^[a-f0-9]{24}$/i)
    .optional(),
  q: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type StaffQuoteListQuery = z.infer<typeof StaffQuoteListQuerySchema>;

export const StaffSendQuoteResponseSchema = z.object({
  quote: StaffQuoteSchema,
  emailSent: z.boolean(),
  acceptUrl: z.string().url().optional(),
});
export type StaffSendQuoteResponse = z.infer<typeof StaffSendQuoteResponseSchema>;

export const StaffDeleteQuoteResponseSchema = z.object({
  ok: z.literal(true),
  id: z.string(),
});
export type StaffDeleteQuoteResponse = z.infer<typeof StaffDeleteQuoteResponseSchema>;
