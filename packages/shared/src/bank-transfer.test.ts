import { describe, expect, it } from "vitest";

import {
  computeBankTransferExpiresAt,
  isBankTransferFullyEligible,
  isBankTransferLeadTimeEligible,
} from "./bank-transfer.js";

describe("bank transfer eligibility", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");

  it("hides transfer when start is only 3 days away", () => {
    const startAt = new Date("2026-07-19T10:00:00.000Z");
    expect(isBankTransferLeadTimeEligible(startAt, now, 7)).toBe(false);
    expect(isBankTransferFullyEligible({ startAt, now })).toBe(false);
  });

  it("allows transfer when start is 10 days away", () => {
    const startAt = new Date("2026-07-26T10:00:00.000Z");
    expect(isBankTransferLeadTimeEligible(startAt, now, 7)).toBe(true);
    const expiry = computeBankTransferExpiresAt({ issuedAt: now, startAt });
    expect(expiry.ok).toBe(true);
    if (expiry.ok) {
      // min(issuedAt+8d=Jul24 12:00, start−2d=Jul24 10:00) = Jul24 10:00
      expect(expiry.expiresAt.toISOString()).toBe("2026-07-24T10:00:00.000Z");
    }
    expect(isBankTransferFullyEligible({ startAt, now })).toBe(true);
  });

  it("rejects exact lead-day edge when safety margin empties the payment window", () => {
    // Lead time OK at exactly +7d, but safetyMarginDays=7 ⇒ start−7 ≤ issuedAt ⇒ reject.
    const startAt = new Date("2026-07-23T12:00:00.000Z");
    expect(isBankTransferLeadTimeEligible(startAt, now, 7)).toBe(true);
    const expiry = computeBankTransferExpiresAt({
      issuedAt: now,
      startAt,
      paymentWindowDays: 8,
      safetyMarginDays: 7,
    });
    expect(expiry).toEqual({ ok: false, reason: "window_too_short" });
    expect(
      isBankTransferFullyEligible({
        startAt,
        now,
        minLeadDays: 7,
        paymentWindowDays: 8,
        safetyMarginDays: 7,
      }),
    ).toBe(false);
  });

  it("rejects when safety margin makes expiresAt <= issuedAt", () => {
    // start = issuedAt + 1 day, safety 2 → start−2 < issuedAt → window_too_short
    const startAt = new Date("2026-07-17T12:00:00.000Z");
    const expiry = computeBankTransferExpiresAt({
      issuedAt: now,
      startAt,
      paymentWindowDays: 8,
      safetyMarginDays: 2,
    });
    expect(expiry).toEqual({ ok: false, reason: "window_too_short" });
    expect(
      isBankTransferFullyEligible({
        startAt,
        now,
        minLeadDays: 0,
      }),
    ).toBe(false);
  });

  it("caps expiry by reservation start minus safety margin when closer than window", () => {
    const startAt = new Date("2026-07-24T12:00:00.000Z"); // +8 days
    const expiry = computeBankTransferExpiresAt({ issuedAt: now, startAt });
    expect(expiry.ok).toBe(true);
    if (expiry.ok) {
      // min(J+8=Jul24 12:00, start−2=Jul22 12:00) = Jul22
      expect(expiry.expiresAt.toISOString()).toBe("2026-07-22T12:00:00.000Z");
    }
  });
});
