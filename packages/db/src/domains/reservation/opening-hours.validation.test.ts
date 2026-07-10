import { describe, expect, it } from "vitest";

import {
  getOpeningWindowForDay,
  getStaySegmentForDay,
  isRangeWithinOpeningHours,
  parisLocalToUtc,
  validateRangeOpeningHours,
  type OpeningHoursCheckable,
} from "./opening-hours.js";

const weekdaySchedule = { open: "08:00", close: "19:00", is24h: false };

function buildSubject(): OpeningHoursCheckable {
  return {
    openingHours: [
      { day: "monday", ...weekdaySchedule },
      { day: "tuesday", ...weekdaySchedule },
      { day: "wednesday", ...weekdaySchedule },
      { day: "thursday", ...weekdaySchedule },
      { day: "friday", ...weekdaySchedule },
      { day: "saturday", ...weekdaySchedule },
      { day: "sunday", ...weekdaySchedule },
    ],
  };
}

describe("validateRangeOpeningHours — same-day non-regression (T1/T2)", () => {
  it("T1: accepts a same-day range within wide opening hours", () => {
    const subject = buildSubject();
    const startAt = parisLocalToUtc("2026-09-01", "10:00");
    const endAt = parisLocalToUtc("2026-09-01", "11:00");

    expect(validateRangeOpeningHours(subject, startAt, endAt)).toEqual({ valid: true });
    expect(isRangeWithinOpeningHours(subject, startAt, endAt)).toBe(true);
  });

  it("T2: rejects a same-day range outside opening hours", () => {
    const subject = buildSubject();
    const startAt = parisLocalToUtc("2026-09-01", "20:00");
    const endAt = parisLocalToUtc("2026-09-01", "21:00");

    const result = validateRangeOpeningHours(subject, startAt, endAt);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.closedDays).toEqual(["2026-09-01"]);
    }
    expect(isRangeWithinOpeningHours(subject, startAt, endAt)).toBe(false);
  });
});

describe("validateRangeOpeningHours — multi-day short stay (T3-T5)", () => {
  it("T3: accepts a 9-day range when every day has wide opening hours", () => {
    const subject = buildSubject();
    const startAt = parisLocalToUtc("2026-07-15", "08:00");
    const endAt = parisLocalToUtc("2026-07-24", "19:00");

    expect(validateRangeOpeningHours(subject, startAt, endAt)).toEqual({ valid: true });
  });

  it("T4: accepts a multi-day range when an intermediate day has reduced but non-empty hours", () => {
    const subject = buildSubject();
    subject.openingHours = subject.openingHours.map((entry) =>
      entry.day === "wednesday" ? { ...entry, open: "10:00", close: "14:00" } : entry,
    );

    const startAt = parisLocalToUtc("2026-07-15", "08:00");
    const endAt = parisLocalToUtc("2026-07-24", "19:00");

    expect(validateRangeOpeningHours(subject, startAt, endAt)).toEqual({ valid: true });
  });

  it("T5: rejects a multi-day range when an intermediate day has no opening schedule", () => {
    const subject = buildSubject();
    subject.openingHours = subject.openingHours.filter((entry) => entry.day !== "saturday");

    const startAt = parisLocalToUtc("2026-07-15", "08:00");
    const endAt = parisLocalToUtc("2026-07-24", "19:00");

    const result = validateRangeOpeningHours(subject, startAt, endAt);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.closedDays).toContain("2026-07-18");
    }
  });
});

describe("opening-hours helpers", () => {
  it("computes stay segment clipped to arrival and departure days", () => {
    const isoDates = ["2026-07-15", "2026-07-16", "2026-07-17"];
    const startAt = parisLocalToUtc("2026-07-15", "08:00");
    const endAt = parisLocalToUtc("2026-07-17", "19:00");

    const first = getStaySegmentForDay("2026-07-15", isoDates, startAt, endAt);
    const middle = getStaySegmentForDay("2026-07-16", isoDates, startAt, endAt);
    const last = getStaySegmentForDay("2026-07-17", isoDates, startAt, endAt);

    expect(first?.start.toISOString()).toBe(startAt.toISOString());
    expect(middle?.start.toISOString()).toBe(parisLocalToUtc("2026-07-16", "00:00").toISOString());
    expect(last?.end.toISOString()).toBe(endAt.toISOString());
  });

  it("returns null opening window for degenerate schedules", () => {
    expect(
      getOpeningWindowForDay(
        { day: "monday", open: "10:00", close: "10:00", is24h: false },
        "2026-07-15",
      ),
    ).toBeNull();
  });
});
