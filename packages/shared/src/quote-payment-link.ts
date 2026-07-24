import { z } from "zod";

/** Public devis Stripe payment-link (Option B — /payer-devis + Elements). */
export const QUOTE_PAYMENT_LINK_ERROR_CODES = {
  PAYMENT_LINK_NOT_FOUND: "PAYMENT_LINK_NOT_FOUND",
  PAYMENT_LINK_EXPIRED: "PAYMENT_LINK_EXPIRED",
  PAYMENT_LINK_CONSUMED: "PAYMENT_LINK_CONSUMED",
  PAYMENT_LINK_REVOKED: "PAYMENT_LINK_REVOKED",
  INVOICE_NOT_PAYABLE: "INVOICE_NOT_PAYABLE",
  STRIPE_NOT_CONFIGURED: "STRIPE_NOT_CONFIGURED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

export type QuotePaymentLinkErrorCode =
  (typeof QUOTE_PAYMENT_LINK_ERROR_CODES)[keyof typeof QUOTE_PAYMENT_LINK_ERROR_CODES];

export const QuotePaymentLinkPreviewQuerySchema = z.object({
  token: z.string().min(64).max(64),
  invoiceId: z.string().min(1),
});

export type QuotePaymentLinkPreviewQuery = z.infer<typeof QuotePaymentLinkPreviewQuerySchema>;

export const QuotePaymentLinkPreviewSchema = z.object({
  invoiceId: z.string().min(1),
  invoiceReference: z.string().min(1),
  quoteId: z.string().min(1),
  quoteReference: z.string().min(1),
  amountDueCents: z.number().int().positive(),
  currency: z.literal("eur"),
  expiresAt: z.string().datetime(),
  isDeposit: z.boolean(),
  reservationIds: z.array(z.string().min(1)).min(1),
});

export type QuotePaymentLinkPreview = z.infer<typeof QuotePaymentLinkPreviewSchema>;

export const CreateQuotePaymentIntentRequestSchema = z.object({
  token: z.string().min(64).max(64),
  invoiceId: z.string().min(1),
});

export type CreateQuotePaymentIntentRequest = z.infer<typeof CreateQuotePaymentIntentRequestSchema>;

export const CreateQuotePaymentIntentResponseSchema = z.object({
  clientSecret: z.string().min(1),
  paymentIntentId: z.string().min(1),
  amountDueCents: z.number().int().positive(),
  currency: z.literal("eur"),
  invoiceReference: z.string().min(1),
});

export type CreateQuotePaymentIntentResponse = z.infer<
  typeof CreateQuotePaymentIntentResponseSchema
>;

export const QuotePaymentStatusQuerySchema = z.object({
  token: z.string().min(64).max(64),
  invoiceId: z.string().min(1),
});

export type QuotePaymentStatusQuery = z.infer<typeof QuotePaymentStatusQuerySchema>;

export const QuotePaymentStatusResponseSchema = z.object({
  paymentState: z.enum(["awaiting_payment", "partially_paid", "paid"]),
  amountDueCents: z.number().int().nonnegative(),
  invoiceReference: z.string().min(1),
  linkStatus: z.enum(["active", "consumed", "revoked", "expired"]),
});

export type QuotePaymentStatusResponse = z.infer<typeof QuotePaymentStatusResponseSchema>;
