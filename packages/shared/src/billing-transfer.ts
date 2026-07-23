import { z } from "zod";

/** Reservation reference as used for bank-transfer labels (RES-YYYY-NNNNN). */
export const RESERVATION_REFERENCE_PATTERN = /\bRES-\d{4}-\d{5}\b/;

export const QontoTransferMatchStatusSchema = z.enum(["exact", "amount_mismatch"]);

export type QontoTransferMatchStatus = z.infer<typeof QontoTransferMatchStatusSchema>;

/**
 * Suggested Qonto credit matched to a pending bank-transfer invoice.
 * Never auto-confirms — staff must explicitly mark received.
 */
export const QontoTransferSuggestionSchema = z.object({
  matchStatus: QontoTransferMatchStatusSchema,
  qontoTxId: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().min(1).default("EUR"),
  settledAt: z.string().datetime().nullable().optional(),
  /** Observed label / reference text from Qonto (no IBAN). */
  observedLabel: z.string().optional(),
  reservationReference: z.string().min(1),
  amountDueCents: z.number().int().nonnegative(),
});

export type QontoTransferSuggestion = z.infer<typeof QontoTransferSuggestionSchema>;

export const MarkBankTransferReceivedRequestSchema = z.object({
  /** Reservation reference (RES-…) or invoice/proforma reference (PF-…). */
  reference: z.string().trim().min(1, "Référence requise"),
  /**
   * Optional Qonto transaction id when confirming a suggested match.
   * Stored on Payment.reconciliation.qontoTxId — never auto-applied without this request.
   */
  qontoTxId: z.string().trim().min(1).optional(),
});

export type MarkBankTransferReceivedRequest = z.infer<typeof MarkBankTransferReceivedRequestSchema>;

export const BankTransferPendingLookupResponseSchema = z.object({
  found: z.boolean(),
  reservationReference: z.string().optional(),
  invoiceId: z.string().optional(),
  invoiceReference: z.string().optional(),
  reservationStatus: z.string().optional(),
  awaitingPaymentMethod: z.enum(["card", "bank_transfer"]).optional(),
  amountDueCents: z.number().int().nonnegative().optional(),
  spaceName: z.string().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  clientEmail: z.string().email().optional(),
  message: z.string().optional(),
  /** Present when polling matched a Qonto credit to this pending transfer. */
  qontoSuggestion: QontoTransferSuggestionSchema.optional(),
});

export type BankTransferPendingLookupResponse = z.infer<
  typeof BankTransferPendingLookupResponseSchema
>;

export const MarkBankTransferReceivedResponseSchema = z.object({
  applied: z.boolean(),
  transitioned: z.boolean(),
  reservationReference: z.string(),
  invoiceReference: z.string(),
  reservationStatus: z.string(),
  paymentId: z.string().nullable(),
  amountReceivedCents: z.number().int().nonnegative(),
  qontoTxId: z.string().nullable().optional(),
});

export type MarkBankTransferReceivedResponse = z.infer<
  typeof MarkBankTransferReceivedResponseSchema
>;

/** Extract the first RES-YYYY-NNNNN token from free text (transfer label, Qonto reference, …). */
export function extractReservationReference(text: string): string | null {
  const match = text.match(RESERVATION_REFERENCE_PATTERN);
  return match?.[0] ?? null;
}

/** Default lookback for validated bank transfers on GET /billing/transfers. */
export const BANK_TRANSFER_VALIDATED_DAYS_DEFAULT = 60;
export const BANK_TRANSFER_VALIDATED_DAYS_MAX = 365;

/**
 * Origin of a validated transfer Payment.
 * Derived from `Payment.reconciliation.qontoTxId` presence — never inferred from
 * Qonto candidates alone (staff can mark manually while a suggestion exists).
 */
export const BankTransferValidatedOriginSchema = z.enum(["qonto", "manual"]);

export type BankTransferValidatedOrigin = z.infer<typeof BankTransferValidatedOriginSchema>;

export const BankTransferTransfersQuerySchema = z.object({
  validatedDays: z.coerce
    .number()
    .int()
    .min(1)
    .max(BANK_TRANSFER_VALIDATED_DAYS_MAX)
    .default(BANK_TRANSFER_VALIDATED_DAYS_DEFAULT),
});

export type BankTransferTransfersQuery = z.infer<typeof BankTransferTransfersQuerySchema>;

export const BankTransferPendingListItemSchema = z.object({
  reservationId: z.string().min(1),
  reservationReference: z.string().min(1),
  invoiceId: z.string().min(1),
  invoiceReference: z.string().min(1),
  clientLabel: z.string().min(1),
  companyName: z.string().nullable().optional(),
  spaceName: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  balanceDueCents: z.number().int().nonnegative(),
  awaitingPaymentExpiresAt: z.string().datetime().nullable().optional(),
  qontoSuggestion: QontoTransferSuggestionSchema.optional(),
});

export type BankTransferPendingListItem = z.infer<typeof BankTransferPendingListItemSchema>;

export const BankTransferValidatedListItemSchema = z.object({
  reservationId: z.string().min(1),
  reservationReference: z.string().min(1),
  invoiceId: z.string().min(1),
  invoiceReference: z.string().min(1),
  paymentId: z.string().min(1),
  clientLabel: z.string().min(1),
  companyName: z.string().nullable().optional(),
  spaceName: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  amountReceivedCents: z.number().int().nonnegative(),
  receivedAt: z.string().datetime(),
  /** Presence of Payment.reconciliation.qontoTxId → qonto, else manual. */
  origin: BankTransferValidatedOriginSchema,
  qontoTxId: z.string().nullable().optional(),
});

export type BankTransferValidatedListItem = z.infer<typeof BankTransferValidatedListItemSchema>;

export const BankTransferTransfersResponseSchema = z.object({
  pending: z.array(BankTransferPendingListItemSchema),
  validated: z.array(BankTransferValidatedListItemSchema),
  validatedDays: z.number().int().positive(),
});

export type BankTransferTransfersResponse = z.infer<typeof BankTransferTransfersResponseSchema>;
