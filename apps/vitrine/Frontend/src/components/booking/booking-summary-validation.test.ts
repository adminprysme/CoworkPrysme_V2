import { describe, expect, it } from "vitest";

import { canProceedToBookingPayment } from "./booking-summary-validation";

describe("canProceedToBookingPayment", () => {
  it("blocks payment when CGV and withdrawal are not both accepted", () => {
    expect(canProceedToBookingPayment({ cgvAccepted: false, withdrawalAcknowledged: false })).toBe(
      false,
    );
    expect(canProceedToBookingPayment({ cgvAccepted: true, withdrawalAcknowledged: false })).toBe(
      false,
    );
    expect(canProceedToBookingPayment({ cgvAccepted: false, withdrawalAcknowledged: true })).toBe(
      false,
    );
  });

  it("allows payment only when CGV and withdrawal are both accepted", () => {
    expect(canProceedToBookingPayment({ cgvAccepted: true, withdrawalAcknowledged: true })).toBe(
      true,
    );
  });
});
