import { z } from "zod";

export const MarkBankTransferReceivedRequestSchema = z.object({
  /** Reservation reference (RES-…) or invoice/proforma reference (PF-…). */
  reference: z.string().trim().min(1, "Référence requise"),
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
});

export type MarkBankTransferReceivedResponse = z.infer<
  typeof MarkBankTransferReceivedResponseSchema
>;
