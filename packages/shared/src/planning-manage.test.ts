import { describe, expect, it } from "vitest";

import {
  classifyDateChange,
  computeCgvScaleRatio,
  computePriceDeltaCents,
  computeShortenRefundSuggestion,
  computeSuggestedRefundCents,
  countBillableUnits,
  resolveSpaceStayPricing,
} from "./planning-manage.js";

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

describe("computeCgvScaleRatio", () => {
  const startAt = new Date("2026-08-01T10:00:00.000Z");

  describe("hourly boundaries", () => {
    it("ratio 1 at exactly 48h before start", () => {
      const result = computeCgvScaleRatio({
        durationClass: "hourly",
        startAt,
        now: new Date(startAt.getTime() - 48 * 3_600_000),
      });
      expect(result.ratio).toBe(1);
      expect(result.hoursBeforeStart).toBe(48);
      expect(result.band).toBe("Plus de 48 heures");
    });

    it("ratio 0.5 just below 48h (47.999…)", () => {
      const result = computeCgvScaleRatio({
        durationClass: "hourly",
        startAt,
        now: new Date(startAt.getTime() - 48 * 3_600_000 + 1),
      });
      expect(result.ratio).toBe(0.5);
      expect(result.band).toBe("Entre 24 et 48 heures");
    });

    it("ratio 0.5 at exactly 24h before start", () => {
      const result = computeCgvScaleRatio({
        durationClass: "hourly",
        startAt,
        now: new Date(startAt.getTime() - 24 * 3_600_000),
      });
      expect(result.ratio).toBe(0.5);
      expect(result.hoursBeforeStart).toBe(24);
      expect(result.band).toBe("Entre 24 et 48 heures");
    });

    it("ratio 0 just below 24h", () => {
      const result = computeCgvScaleRatio({
        durationClass: "hourly",
        startAt,
        now: new Date(startAt.getTime() - 24 * 3_600_000 + 1),
      });
      expect(result.ratio).toBe(0);
      expect(result.band).toBe("Moins de 24 heures");
    });

    it("halfday uses the same hourly bands", () => {
      const result = computeCgvScaleRatio({
        durationClass: "halfday",
        startAt,
        now: new Date(startAt.getTime() - 36 * 3_600_000),
      });
      expect(result.ratio).toBe(0.5);
    });
  });

  describe("daily boundaries", () => {
    it("ratio 1 at exactly 7 days before start", () => {
      const result = computeCgvScaleRatio({
        durationClass: "daily",
        startAt,
        now: new Date(startAt.getTime() - 7 * 86_400_000),
      });
      expect(result.ratio).toBe(1);
      expect(result.band).toBe("Plus de 7 jours");
    });

    it("ratio 0.5 just below 7 days", () => {
      const result = computeCgvScaleRatio({
        durationClass: "daily",
        startAt,
        now: new Date(startAt.getTime() - 7 * 86_400_000 + 1),
      });
      expect(result.ratio).toBe(0.5);
      expect(result.band).toBe("Entre 3 et 7 jours");
    });

    it("ratio 0.5 at exactly 3 days before start", () => {
      const result = computeCgvScaleRatio({
        durationClass: "daily",
        startAt,
        now: new Date(startAt.getTime() - 3 * 86_400_000),
      });
      expect(result.ratio).toBe(0.5);
      expect(result.band).toBe("Entre 3 et 7 jours");
    });

    it("ratio 0 just below 3 days", () => {
      const result = computeCgvScaleRatio({
        durationClass: "daily",
        startAt,
        now: new Date(startAt.getTime() - 3 * 86_400_000 + 1),
      });
      expect(result.ratio).toBe(0);
      expect(result.band).toBe("Moins de 3 jours");
    });
  });
});

describe("classifyDateChange", () => {
  const oldStart = new Date("2026-07-20T08:00:00.000Z");
  const oldEnd = new Date("2026-07-20T12:00:00.000Z");

  it("detects extend when new interval fully contains old", () => {
    expect(
      classifyDateChange({
        oldStart,
        oldEnd,
        newStart: new Date("2026-07-20T07:00:00.000Z"),
        newEnd: new Date("2026-07-20T13:00:00.000Z"),
      }),
    ).toBe("extend");
  });

  it("detects shorten when new is a subset of old", () => {
    expect(
      classifyDateChange({
        oldStart,
        oldEnd,
        newStart: new Date("2026-07-20T09:00:00.000Z"),
        newEnd: new Date("2026-07-20T11:00:00.000Z"),
      }),
    ).toBe("shorten");
  });

  it("detects shift when same duration but moved", () => {
    expect(
      classifyDateChange({
        oldStart,
        oldEnd,
        newStart: new Date("2026-07-20T10:00:00.000Z"),
        newEnd: new Date("2026-07-20T14:00:00.000Z"),
      }),
    ).toBe("shift");
  });

  it("treats longer duration without full containment as extend", () => {
    expect(
      classifyDateChange({
        oldStart,
        oldEnd,
        newStart: new Date("2026-07-20T10:00:00.000Z"),
        newEnd: new Date("2026-07-20T16:00:00.000Z"),
      }),
    ).toBe("extend");
  });
});

describe("countBillableUnits", () => {
  it("counts 2 inclusive Paris calendar days for a daily stay", () => {
    // Exclusive end at Paris midnight of day+2 → last moment is still day+1
    const startAt = new Date("2026-07-20T06:00:00.000Z"); // 08:00 Paris (CEST)
    const endAt = new Date("2026-07-22T00:00:00.000+02:00"); // midnight Paris Jul 22
    expect(countBillableUnits(startAt, endAt, "daily")).toBe(2);
  });
});

describe("computeShortenRefundSuggestion", () => {
  it("applies CGV 50% band on removed value when not started", () => {
    const oldStart = new Date("2026-08-01T10:00:00.000Z");
    const oldEnd = new Date("2026-08-01T14:00:00.000Z"); // 4h
    const newStart = oldStart;
    const newEnd = new Date("2026-08-01T12:00:00.000Z"); // shortened to 2h → 50% removed
    // 36h before start → hourly CGV ratio 0.5
    const now = new Date(oldStart.getTime() - 36 * 3_600_000);

    const result = computeShortenRefundSuggestion({
      durationClass: "hourly",
      oldStart,
      oldEnd,
      newStart,
      newEnd,
      paidTotalCents: 10_000,
      now,
    });

    expect(result.basis).toBe("cgv_scale");
    expect(result.removedValueCents).toBe(5_000);
    expect(result.cgvRatio).toBe(0.5);
    expect(result.suggestedRefundCents).toBe(2_500);
  });

  it("uses prorata of removed portion while in progress", () => {
    const oldStart = new Date("2026-07-20T08:00:00.000Z");
    const oldEnd = new Date("2026-07-20T12:00:00.000Z"); // 4h
    const newStart = oldStart;
    const newEnd = new Date("2026-07-20T10:00:00.000Z"); // remove last 2h
    const now = new Date("2026-07-20T09:00:00.000Z"); // in progress

    const result = computeShortenRefundSuggestion({
      durationClass: "hourly",
      oldStart,
      oldEnd,
      newStart,
      newEnd,
      paidTotalCents: 10_000,
      now,
    });

    expect(result.basis).toBe("prorata_removed");
    expect(result.removedValueCents).toBe(5_000);
    expect(result.suggestedRefundCents).toBe(5_000);
  });
});

describe("resolveSpaceStayPricing", () => {
  const tariffs = [
    { durationClass: "hourly" as const, priceHT: 2_000, vatRate: 20, enabled: true },
    { durationClass: "daily" as const, priceHT: 18_000, vatRate: 20, enabled: true },
    { durationClass: "weekly" as const, priceHT: 90_000, vatRate: 20, enabled: true },
    { durationClass: "monthly" as const, priceHT: 260_000, vatRate: 20, enabled: true },
  ];

  it("keeps daily for a short multi-day stay (below weekly threshold)", () => {
    const result = resolveSpaceStayPricing({
      startAt: new Date("2026-08-12T06:00:00.000Z"),
      endAt: new Date("2026-08-14T17:00:00.000Z"),
      tariffs,
    });
    expect(result.durationClass).toBe("daily");
    expect(result.units).toBe(3);
    expect(result.spaceHT).toBe(54_000);
  });

  it("selects weekly instead of 7× daily when the stay crosses the weekly tier", () => {
    const result = resolveSpaceStayPricing({
      startAt: new Date("2026-08-12T06:00:00.000Z"),
      endAt: new Date("2026-08-18T17:00:00.000Z"),
      tariffs,
    });
    expect(result.durationClass).toBe("weekly");
    expect(result.units).toBe(1);
    expect(result.unitPriceHT).toBe(90_000);
    expect(result.spaceHT).toBe(90_000);
    expect(result.spaceHT).toBeLessThan(7 * 18_000);
  });

  it("does not apply monthly to a 7-day stay even if ceil(days/30)=1", () => {
    const result = resolveSpaceStayPricing({
      startAt: new Date("2026-08-12T06:00:00.000Z"),
      endAt: new Date("2026-08-18T17:00:00.000Z"),
      tariffs,
    });
    expect(result.durationClass).not.toBe("monthly");
  });
});
