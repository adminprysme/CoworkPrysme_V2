import { describe, expect, it } from "vitest";
import type { Types } from "mongoose";

import {
  isRangeBlockedWithCache,
  rangesOverlap,
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
