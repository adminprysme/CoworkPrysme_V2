import { describe, expect, it } from "vitest";

import {
  CreateBookingPaymentIntentRequestSchema,
  CreateBookingPaymentIntentResponseSchema,
  BookingPaymentStatusQuerySchema,
} from "./booking-payment.js";

describe("booking payment schemas", () => {
  it("requires paymentAccessToken and rejects client-supplied amount on intent request", () => {
    const withoutToken = CreateBookingPaymentIntentRequestSchema.safeParse({
      reservationReference: "RES-2026-00001",
      invoiceReference: "PF-2026-00001",
    });
    expect(withoutToken.success).toBe(false);

    const parsed = CreateBookingPaymentIntentRequestSchema.safeParse({
      reservationReference: "RES-2026-00001",
      invoiceReference: "PF-2026-00001",
      paymentAccessToken: "signed.token",
      amount: 9999,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        reservationReference: "RES-2026-00001",
        invoiceReference: "PF-2026-00001",
        paymentAccessToken: "signed.token",
      });
      expect("amount" in parsed.data).toBe(false);
    }
  });

  it("requires paymentAccessToken on status query", () => {
    expect(
      BookingPaymentStatusQuerySchema.safeParse({
        reservationReference: "RES-2026-00001",
        invoiceReference: "PF-2026-00001",
      }).success,
    ).toBe(false);
    expect(
      BookingPaymentStatusQuerySchema.safeParse({
        reservationReference: "RES-2026-00001",
        invoiceReference: "PF-2026-00001",
        paymentAccessToken: "signed.token",
      }).success,
    ).toBe(true);
  });

  it("requires server-computed amount on payment intent response", () => {
    const parsed = CreateBookingPaymentIntentResponseSchema.safeParse({
      clientSecret: "pi_test_secret",
      paymentIntentId: "pi_test",
      amount: 4800,
      currency: "eur",
    });
    expect(parsed.success).toBe(true);
  });
});
