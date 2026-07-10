import { describe, expect, it } from "vitest";

import {
  buildFlexibilityOffsets,
  mergeAvailabilityWindows,
  shiftInstantByDays,
} from "./flexibility.util.js";

describe("flexibility.util", () => {
  it("buildFlexibilityOffsets returns symmetric day offsets", () => {
    expect(buildFlexibilityOffsets(3)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
  });

  it("shiftInstantByDays preserves clock time", () => {
    const base = new Date("2026-07-15T08:00:00.000Z");
    expect(shiftInstantByDays(base, 2).toISOString()).toBe("2026-07-17T08:00:00.000Z");
    expect(shiftInstantByDays(base, -1).toISOString()).toBe("2026-07-14T08:00:00.000Z");
  });

  it("mergeAvailabilityWindows deduplicates and sorts", () => {
    const merged = mergeAvailabilityWindows([
      { startAt: "2026-07-16T08:00:00.000Z", endAt: "2026-07-16T09:00:00.000Z" },
      { startAt: "2026-07-15T08:00:00.000Z", endAt: "2026-07-15T09:00:00.000Z" },
      { startAt: "2026-07-15T08:00:00.000Z", endAt: "2026-07-15T09:00:00.000Z" },
    ]);

    expect(merged).toEqual([
      { startAt: "2026-07-15T08:00:00.000Z", endAt: "2026-07-15T09:00:00.000Z" },
      { startAt: "2026-07-16T08:00:00.000Z", endAt: "2026-07-16T09:00:00.000Z" },
    ]);
  });
});
