import { z } from "zod";

/** Mirrors packages/db INVOICE_TYPES / INVOICE_STATUSES (keep in sync). */
export const StaffInvoiceTypeSchema = z.enum(["proforma", "final"]);
export type StaffInvoiceType = z.infer<typeof StaffInvoiceTypeSchema>;

export const StaffInvoiceStatusSchema = z.enum([
  "proforma",
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
]);
export type StaffInvoiceStatus = z.infer<typeof StaffInvoiceStatusSchema>;

export const StaffInvoiceTotalsSchema = z.object({
  ht: z.number().int(),
  vat: z.number().int(),
  ttc: z.number().int(),
  discountTotal: z.number().int().nonnegative(),
  paidTotal: z.number().int().nonnegative(),
  balanceDue: z.number().int(),
});
export type StaffInvoiceTotals = z.infer<typeof StaffInvoiceTotalsSchema>;

export const StaffCardexInvoiceSchema = z.object({
  id: z.string(),
  reference: z.string(),
  type: StaffInvoiceTypeSchema,
  status: StaffInvoiceStatusSchema,
  totals: StaffInvoiceTotalsSchema,
  issuedAt: z.string().datetime().optional(),
  reservationId: z.string().optional(),
});
export type StaffCardexInvoice = z.infer<typeof StaffCardexInvoiceSchema>;

export const StaffCardexInvoicesListResponseSchema = z.object({
  invoices: z.array(StaffCardexInvoiceSchema),
});
export type StaffCardexInvoicesListResponse = z.infer<typeof StaffCardexInvoicesListResponseSchema>;

export const CARDEX_INVOICE_STAFF_ERROR_CODES = {
  CARDEX_NOT_FOUND: "CARDEX_NOT_FOUND",
  INVOICE_NOT_FOUND: "INVOICE_NOT_FOUND",
  INVALID_ID: "INVALID_ID",
} as const;

export type CardexInvoiceStaffErrorCode =
  (typeof CARDEX_INVOICE_STAFF_ERROR_CODES)[keyof typeof CARDEX_INVOICE_STAFF_ERROR_CODES];

export const CARDEX_INVOICE_STAFF_ERROR_MESSAGES = {
  CARDEX_NOT_FOUND: "Cardex introuvable.",
  INVOICE_NOT_FOUND: "Facture introuvable.",
  INVALID_ID: "Identifiant invalide.",
} as const;
