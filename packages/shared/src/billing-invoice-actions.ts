import { z } from "zod";

import {
  StaffInvoiceStatusSchema,
  StaffInvoiceTotalsSchema,
  StaffInvoiceTypeSchema,
} from "./cardex-invoices-staff.js";
import { StaffPaymentMethodSchema } from "./billing-invoices.js";

export const StaffMarkInvoicePaidRequestSchema = z.object({
  amountReceived: z.number().int().positive(),
  note: z.string().trim().max(2000).optional(),
});
export type StaffMarkInvoicePaidRequest = z.infer<typeof StaffMarkInvoicePaidRequestSchema>;

export const StaffMarkInvoicePaidResponseSchema = z.object({
  applied: z.boolean(),
  invoice: z.object({
    id: z.string(),
    reference: z.string(),
    status: StaffInvoiceStatusSchema,
    type: StaffInvoiceTypeSchema,
    totals: StaffInvoiceTotalsSchema,
    paidAt: z.string().datetime().optional(),
  }),
  payment: z
    .object({
      id: z.string(),
      amount: z.number().int().nonnegative(),
      method: StaffPaymentMethodSchema,
      receivedAt: z.string().datetime(),
      manualNote: z.string().nullable(),
    })
    .nullable(),
});
export type StaffMarkInvoicePaidResponse = z.infer<typeof StaffMarkInvoicePaidResponseSchema>;

export const StaffBillingInvoiceDetailPaymentSchema = z.object({
  id: z.string(),
  amount: z.number().int().nonnegative(),
  method: StaffPaymentMethodSchema,
  kind: z.string(),
  receivedAt: z.string().datetime(),
  manualNote: z.string().nullable(),
  markedByStaffProfileId: z.string().nullable(),
});
export type StaffBillingInvoiceDetailPayment = z.infer<
  typeof StaffBillingInvoiceDetailPaymentSchema
>;

export const StaffBillingInvoiceDetailReservationSchema = z.object({
  id: z.string(),
  reference: z.string(),
  status: z.string(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  spaceName: z.string(),
  spaceId: z.string().nullable(),
});
export type StaffBillingInvoiceDetailReservation = z.infer<
  typeof StaffBillingInvoiceDetailReservationSchema
>;

export const StaffBillingInvoiceDetailLineSchema = z.object({
  label: z.string(),
  kind: z.string(),
  qty: z.number(),
  totalHT: z.number().int(),
  totalVAT: z.number().int(),
  totalTTC: z.number().int(),
});

export const StaffBillingInvoiceDetailResponseSchema = z.object({
  id: z.string(),
  reference: z.string(),
  type: StaffInvoiceTypeSchema,
  status: StaffInvoiceStatusSchema,
  totals: StaffInvoiceTotalsSchema,
  issuedAt: z.string().datetime().optional(),
  paidAt: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  cardexId: z.string(),
  clientLabel: z.string(),
  companyLegalName: z.string().nullable(),
  emails: z.array(z.string()),
  quote: z
    .object({
      id: z.string(),
      reference: z.string(),
      status: z.string(),
    })
    .nullable(),
  lines: z.array(StaffBillingInvoiceDetailLineSchema),
  reservations: z.array(StaffBillingInvoiceDetailReservationSchema),
  payments: z.array(StaffBillingInvoiceDetailPaymentSchema),
});
export type StaffBillingInvoiceDetailResponse = z.infer<
  typeof StaffBillingInvoiceDetailResponseSchema
>;
