import { describe, expect, it } from "vitest";
import type { Types } from "mongoose";

import {
  isRangeBlockedWithCache,
  rangesOverlap,
  validateRangeAccessibility,
  type RangeAvailabilityContext,
  type RangeBlockingCache,
} from "./availability.js";
import { parisLocalToUtc } from "./opening-hours.js";

const spaceId = "507f1f77bcf86cd799439011" as unknown as Types.ObjectId;
const buildingId = "507f1f77bcf86cd799439012" as unknown as Types.ObjectId;

function buildContext(startAt: Date, endAt: Date): RangeAvailabilityContext {
  const weekdaySchedule = { open: "08:00", close: "19:00", is24h: false };
  return {
    spaceId,
    buildingId,
    spaceType: "meeting_room",
    openingHours: [
      { day: "monday", ...weekdaySchedule },
      { day: "tuesday", ...weekdaySchedule },
      { day: "wednesday", ...weekdaySchedule },
      { day: "thursday", ...weekdaySchedule },
      { day: "friday", ...weekdaySchedule },
      { day: "saturday", ...weekdaySchedule },
      { day: "sunday", ...weekdaySchedule },
    ],
    startAt,
    endAt,
  };
}

describe("rangesOverlap", () => {
  it("detects partial overlap", () => {
    const leftStart = new Date("2026-09-01T08:00:00.000Z");
    const leftEnd = new Date("2026-09-01T09:00:00.000Z");
    const rightStart = new Date("2026-09-01T08:30:00.000Z");
    const rightEnd = new Date("2026-09-01T10:00:00.000Z");
    expect(rangesOverlap(leftStart, leftEnd, rightStart, rightEnd)).toBe(true);
  });

  it("returns false for adjacent ranges", () => {
    const leftStart = new Date("2026-09-01T08:00:00.000Z");
    const leftEnd = new Date("2026-09-01T09:00:00.000Z");
    const rightStart = new Date("2026-09-01T09:00:00.000Z");
    const rightEnd = new Date("2026-09-01T10:00:00.000Z");
    expect(rangesOverlap(leftStart, leftEnd, rightStart, rightEnd)).toBe(false);
  });
});

describe("isRangeBlockedWithCache", () => {
  it("blocks when a cached reservation overlaps", () => {
    const startAt = parisLocalToUtc("2026-09-01", "10:00");
    const endAt = parisLocalToUtc("2026-09-01", "11:00");
    const cache: RangeBlockingCache = {
      reservations: [
        {
          startAt: parisLocalToUtc("2026-09-01", "10:30"),
          endAt: parisLocalToUtc("2026-09-01", "12:00"),
        } as RangeBlockingCache["reservations"][number],
      ],
      locks: [],
      closures: [],
    };

    expect(isRangeBlockedWithCache(buildContext(startAt, endAt), cache)).toBe(true);
  });

  it("allows when no cached blockers overlap", () => {
    const startAt = parisLocalToUtc("2026-09-01", "10:00");
    const endAt = parisLocalToUtc("2026-09-01", "11:00");
    const cache: RangeBlockingCache = {
      reservations: [
        {
          startAt: parisLocalToUtc("2026-09-01", "12:00"),
          endAt: parisLocalToUtc("2026-09-01", "13:00"),
        } as RangeBlockingCache["reservations"][number],
      ],
      locks: [],
      closures: [],
    };

    expect(isRangeBlockedWithCache(buildContext(startAt, endAt), cache)).toBe(false);
  });
});

describe("validateRangeAccessibility — closures per day (T6-T8)", () => {
  it("T6: rejects when a closure fully covers an intermediate day's accessible window", () => {
    const startAt = parisLocalToUtc("2026-07-15", "08:00");
    const endAt = parisLocalToUtc("2026-07-24", "19:00");
    const context = buildContext(startAt, endAt);

    const result = validateRangeAccessibility(context, [
      {
        startAt: parisLocalToUtc("2026-07-16", "08:00"),
        endAt: parisLocalToUtc("2026-07-16", "19:00"),
      },
    ]);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.closedDays).toContain("2026-07-16");
    }
  });

  it("T7: multi-day range stays available when only a partial closure overlaps one day", () => {
    const startAt = parisLocalToUtc("2026-07-15", "08:00");
    const endAt = parisLocalToUtc("2026-07-24", "19:00");
    const context = buildContext(startAt, endAt);

    expect(
      validateRangeAccessibility(context, [
        {
          startAt: parisLocalToUtc("2026-07-16", "14:00"),
          endAt: parisLocalToUtc("2026-07-16", "16:00"),
        },
      ]),
    ).toEqual({ valid: true });

    expect(
      isRangeBlockedWithCache(context, {
        reservations: [],
        locks: [],
        closures: [
          {
            startAt: parisLocalToUtc("2026-07-16", "14:00"),
            endAt: parisLocalToUtc("2026-07-16", "16:00"),
          } as RangeBlockingCache["closures"][number],
        ],
      }),
    ).toBe(false);
  });

  it("T8: multi-day range is blocked when a reservation overlaps despite valid opening hours", () => {
    const startAt = parisLocalToUtc("2026-07-15", "08:00");
    const endAt = parisLocalToUtc("2026-07-24", "19:00");
    const context = buildContext(startAt, endAt);

    expect(validateRangeAccessibility(context, [])).toEqual({ valid: true });
    expect(
      isRangeBlockedWithCache(context, {
        reservations: [
          {
            startAt: parisLocalToUtc("2026-07-18", "10:00"),
            endAt: parisLocalToUtc("2026-07-18", "12:00"),
          } as RangeBlockingCache["reservations"][number],
        ],
        locks: [],
        closures: [],
      }),
    ).toBe(true);
  });
});
