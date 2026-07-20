import { describe, expect, it } from "vitest";

import { computePriceDeltaCents, computeSuggestedRefundCents } from "./planning-manage.js";

describe("computeSuggestedRefundCents", () => {
  const startAt = new Date("2026-07-20T08:00:00.000Z");
  const endAt = new Date("2026-07-20T12:00:00.000Z"); // 4h = 14_400_000 ms

  it("returns full paid amount when reservation has not started", () => {
    const result = computeSuggestedRefundCents({
      startAt,
      endAt,
      paidTotalCents: 10_000,
      now: new Date("2026-07-20T07:00:00.000Z"),
    });
    expect(result.basis).toBe("not_started");
    expect(result.suggestedRefundCents).toBe(10_000);
  });

  it("returns unpaid basis when nothing was paid", () => {
    const result = computeSuggestedRefundCents({
      startAt,
      endAt,
      paidTotalCents: 0,
      now: new Date("2026-07-20T07:00:00.000Z"),
    });
    expect(result.basis).toBe("unpaid");
    expect(result.suggestedRefundCents).toBe(0);
  });

  it("prorates remaining time in integer cents while in progress", () => {
    // Halfway through a 4h stay with 10_000¢ paid → remaining 2h → 5_000¢
    const result = computeSuggestedRefundCents({
      startAt,
      endAt,
      paidTotalCents: 10_000,
      now: new Date("2026-07-20T10:00:00.000Z"),
    });
    expect(result.basis).toBe("in_progress");
    expect(result.suggestedRefundCents).toBe(5_000);
    expect(result.remainingMs).toBe(2 * 60 * 60 * 1000);
  });

  it("returns 0 after the stay has ended", () => {
    const result = computeSuggestedRefundCents({
      startAt,
      endAt,
      paidTotalCents: 10_000,
      now: new Date("2026-07-20T13:00:00.000Z"),
    });
    expect(result.basis).toBe("ended");
    expect(result.suggestedRefundCents).toBe(0);
  });
});

describe("computePriceDeltaCents", () => {
  it("computes signed TTC delta in cents", () => {
    expect(computePriceDeltaCents(2000, 3500)).toEqual({
      previousTotalTTC: 2000,
      nextTotalTTC: 3500,
      deltaTTC: 1500,
    });
    expect(computePriceDeltaCents(3500, 2000).deltaTTC).toBe(-1500);
  });
});
