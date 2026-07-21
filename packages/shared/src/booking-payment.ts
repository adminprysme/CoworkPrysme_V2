import { z } from "zod";

/**
 * Card payment intent/status require an HMAC paymentAccessToken issued at confirm.
 * @see ARCHITECTURE.md — Stripe Phase 4a / payment access token
 */

/** Max lifetime for paymentAccessToken / intent eligibility (aligned with invoice issuedAt window). */
export const BOOKING_PAYMENT_ACCESS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export const BOOKING_PAYMENT_ERROR_CODES = {
  INVOICE_NOT_FOUND: "INVOICE_NOT_FOUND",
  RESERVATION_MISMATCH: "RESERVATION_MISMATCH",
  INVOICE_NOT_PAYABLE: "INVOICE_NOT_PAYABLE",
  INVOICE_EXPIRED: "INVOICE_EXPIRED",
  ALREADY_PAID: "ALREADY_PAID",
  STRIPE_NOT_CONFIGURED: "STRIPE_NOT_CONFIGURED",
  PAYMENT_TOKEN_INVALID: "PAYMENT_TOKEN_INVALID",
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

export type BookingPaymentErrorCode =
  (typeof BOOKING_PAYMENT_ERROR_CODES)[keyof typeof BOOKING_PAYMENT_ERROR_CODES];

export const CreateBookingPaymentIntentRequestSchema = z.object({
  reservationReference: z.string().trim().min(1),
  invoiceReference: z.string().trim().min(1),
  paymentAccessToken: z.string().trim().min(1),
  // Intentionally no amount field — server always recomputes from invoice.totals.balanceDue.
});

export type CreateBookingPaymentIntentRequest = z.infer<
  typeof CreateBookingPaymentIntentRequestSchema
>;

export const CreateBookingPaymentIntentResponseSchema = z.object({
  clientSecret: z.string().min(1),
  paymentIntentId: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.string().min(1),
});

export type CreateBookingPaymentIntentResponse = z.infer<
  typeof CreateBookingPaymentIntentResponseSchema
>;

export const BookingPaymentStatusQuerySchema = z.object({
  reservationReference: z.string().trim().min(1),
  invoiceReference: z.string().trim().min(1),
  paymentAccessToken: z.string().trim().min(1),
});

export type BookingPaymentStatusQuery = z.infer<typeof BookingPaymentStatusQuerySchema>;

/** Same auth as status/intent — used by the Stripe reconcile safety net after poll timeout. */
export const ReconcileBookingPaymentRequestSchema = z.object({
  reservationReference: z.string().trim().min(1),
  invoiceReference: z.string().trim().min(1),
  paymentAccessToken: z.string().trim().min(1),
});

export type ReconcileBookingPaymentRequest = z.infer<typeof ReconcileBookingPaymentRequestSchema>;

export const BookingPaymentStateSchema = z.enum([
  "awaiting_payment",
  "confirming",
  "paid",
  "partially_paid",
  "failed",
]);

export type BookingPaymentState = z.infer<typeof BookingPaymentStateSchema>;

export const BookingPaymentStatusResponseSchema = z.object({
  reservationReference: z.string(),
  invoiceReference: z.string(),
  invoiceStatus: z.enum(["proforma", "issued", "partially_paid", "paid", "overdue", "cancelled"]),
  invoiceType: z.literal("proforma"),
  paidTotal: z.number().int().min(0),
  balanceDue: z.number().int().min(0),
  paymentState: BookingPaymentStateSchema,
  /** Real reservation.status — UI must follow this, not display-only copy. */
  reservationStatus: z.enum([
    "pending",
    "awaiting_payment",
    "confirmed",
    "cancelled",
    "completed",
    "no_show",
  ]),
});

export type BookingPaymentStatusResponse = z.infer<typeof BookingPaymentStatusResponseSchema>;

export const BookingPaymentErrorResponseSchema = z.object({
  code: z.enum([
    BOOKING_PAYMENT_ERROR_CODES.INVOICE_NOT_FOUND,
    BOOKING_PAYMENT_ERROR_CODES.RESERVATION_MISMATCH,
    BOOKING_PAYMENT_ERROR_CODES.INVOICE_NOT_PAYABLE,
    BOOKING_PAYMENT_ERROR_CODES.INVOICE_EXPIRED,
    BOOKING_PAYMENT_ERROR_CODES.ALREADY_PAID,
    BOOKING_PAYMENT_ERROR_CODES.STRIPE_NOT_CONFIGURED,
    BOOKING_PAYMENT_ERROR_CODES.PAYMENT_TOKEN_INVALID,
    BOOKING_PAYMENT_ERROR_CODES.VALIDATION_ERROR,
  ]),
  message: z.string(),
});
