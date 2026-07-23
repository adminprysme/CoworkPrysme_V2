import { z } from "zod";

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

const optionalTrimmed = z.string().trim().min(1).optional();

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
