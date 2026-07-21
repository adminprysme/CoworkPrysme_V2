import { describe, expect, it } from "vitest";

import { computePaymentRefundCaps } from "../domains/billing/payment-refund-caps.js";

describe("computePaymentRefundCaps", () => {
  it("nets succeeded Stripe refunds from card paid (clarification 1)", () => {
    const caps = computePaymentRefundCaps([
      {
        kind: "full",
        method: "card",
        amount: 10_000,
        reconciliation: { status: "matched", stripeRefundId: null },
      },
      {
        kind: "refund",
        method: "card",
        amount: 3_000,
        reconciliation: { status: "matched", stripeRefundId: "re_1" },
      },
      {
        kind: "refund",
        method: "card",
        amount: 1_000,
        reconciliation: { status: "pending", stripeRefundId: "re_pending" },
      },
      {
        kind: "refund",
        method: "card",
        amount: 500,
        reconciliation: { status: "failed", stripeRefundId: "re_fail" },
      },
    ]);

    expect(caps.cardPaidCents).toBe(10_000);
    expect(caps.cardRefundedCents).toBe(3_000);
    expect(caps.stripeRefundableCents).toBe(7_000);
    expect(caps.refundExecution).toBe("stripe_card");
  });

  it("prefers stripe_card when card refundable, else manual_transfer", () => {
    const transferOnly = computePaymentRefundCaps([
      {
        kind: "full",
        method: "transfer",
        amount: 5_000,
        reconciliation: { status: "matched" },
      },
    ]);
    expect(transferOnly.refundExecution).toBe("manual_transfer");
    expect(transferOnly.transferRefundableCents).toBe(5_000);

    const none = computePaymentRefundCaps([]);
    expect(none.refundExecution).toBe("none");
  });
});
