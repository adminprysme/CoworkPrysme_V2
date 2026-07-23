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

/** Prospect / clientDraft identity before cardex (send without cardex). */
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

export const QuoteDepositPercentSchema = z.number().int().min(0).max(100);
