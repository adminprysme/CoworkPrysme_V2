import { describe, expect, it } from "vitest";

import {
  CreateBookingPaymentIntentRequestSchema,
  CreateBookingPaymentIntentResponseSchema,
} from "./booking-payment.js";

describe("booking payment schemas", () => {
  it("rejects client-supplied amount on payment intent request", () => {
    const parsed = CreateBookingPaymentIntentRequestSchema.safeParse({
      reservationReference: "RES-2026-00001",
      invoiceReference: "PF-2026-00001",
      amount: 9999,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        reservationReference: "RES-2026-00001",
        invoiceReference: "PF-2026-00001",
      });
      expect("amount" in parsed.data).toBe(false);
    }
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
