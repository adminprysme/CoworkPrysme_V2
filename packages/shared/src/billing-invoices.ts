import { z } from "zod";

import {
  StaffInvoiceStatusSchema,
  StaffInvoiceTotalsSchema,
  StaffInvoiceTypeSchema,
} from "./cardex-invoices-staff.js";

/** Mirrors packages/db PAYMENT_METHODS (keep in sync). */
export const StaffPaymentMethodSchema = z.enum(["card", "transfer", "direct_debit", "cash"]);
export type StaffPaymentMethod = z.infer<typeof StaffPaymentMethodSchema>;

export const StaffBillingInvoiceListItemSchema = z.object({
  id: z.string(),
  reference: z.string(),
  type: StaffInvoiceTypeSchema,
  status: StaffInvoiceStatusSchema,
  totals: StaffInvoiceTotalsSchema,
  cardexId: z.string(),
  clientLabel: z.string(),
  /** Join Cardex.company.legalName when present. */
  companyLegalName: z.string().nullable(),
  /** @deprecated Prefer companyLegalName — kept for InvoicesListPage compat. */
  companyName: z.string().nullable(),
  /** Owner / member emails linked to the cardex (for display + search). */
  emails: z.array(z.string()),
  /**
   * Payment methods seen on this invoice: recorded Payments, else awaiting
   * method on linked reservations (bank_transfer → transfer).
   */
  paymentMethods: z.array(StaffPaymentMethodSchema),
  /** Primary method when at least one is known (first of paymentMethods). */
  paymentMethod: StaffPaymentMethodSchema.nullable(),
  issuedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type StaffBillingInvoiceListItem = z.infer<typeof StaffBillingInvoiceListItemSchema>;

/** Aggregates over the filtered set (not only the current page). */
export const StaffBillingInvoiceListSummarySchema = z.object({
  invoiceCount: z.number().int().nonnegative(),
  balanceDueCents: z.number().int(),
  paidTotalCents: z.number().int().nonnegative(),
});
export type StaffBillingInvoiceListSummary = z.infer<typeof StaffBillingInvoiceListSummarySchema>;

export const StaffBillingInvoiceListResponseSchema = z.object({
  invoices: z.array(StaffBillingInvoiceListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  summary: StaffBillingInvoiceListSummarySchema,
});
export type StaffBillingInvoiceListResponse = z.infer<typeof StaffBillingInvoiceListResponseSchema>;

export const StaffBillingInvoiceListQuerySchema = z.object({
  /** Client name, company, email, or invoice reference. */
  q: z.string().trim().min(1).max(200).optional(),
  status: StaffInvoiceStatusSchema.optional(),
  paymentMethod: StaffPaymentMethodSchema.optional(),
  issuedFrom: z.string().datetime().optional(),
  issuedTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type StaffBillingInvoiceListQuery = z.infer<typeof StaffBillingInvoiceListQuerySchema>;
