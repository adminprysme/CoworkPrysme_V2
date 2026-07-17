import { describe, expect, it } from "vitest";

import { BookingPaymentMethodSchema } from "./booking-confirm.js";

describe("BookingPaymentMethodSchema", () => {
  it("accepts card and bank_transfer", () => {
    expect(BookingPaymentMethodSchema.parse("card")).toBe("card");
    expect(BookingPaymentMethodSchema.parse("bank_transfer")).toBe("bank_transfer");
  });

  it("rejects retired proforma payment method", () => {
    const result = BookingPaymentMethodSchema.safeParse("proforma");
    expect(result.success).toBe(false);
  });
});
