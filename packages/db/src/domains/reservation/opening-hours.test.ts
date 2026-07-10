import { describe, expect, it } from "vitest";

import { parisDateParts, parisLocalToUtc } from "./opening-hours.js";

describe("parisLocalToUtc", () => {
  it.each([
    ["2026-09-01", "08:00", "2026-09-01T06:00:00.000Z"],
    ["2026-09-01", "19:00", "2026-09-01T17:00:00.000Z"],
    ["2026-01-15", "10:00", "2026-01-15T09:00:00.000Z"],
    ["2026-07-10", "12:00", "2026-07-10T10:00:00.000Z"],
    ["2026-09-30", "23:59", "2026-09-30T21:59:00.000Z"],
  ] as const)("resolves %s %s to %s", (isoDate, hhmm, expectedIso) => {
    const resolved = parisLocalToUtc(isoDate, hhmm);
    expect(resolved.toISOString()).toBe(expectedIso);
    const parts = parisDateParts(resolved);
    expect(parts.isoDate).toBe(isoDate);
    expect(parts.minutes).toBe(Number(hhmm.split(":")[0]) * 60 + Number(hhmm.split(":")[1]));
  });
});
