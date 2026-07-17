import { describe, expect, it } from "vitest";

import { formatAvailabilityWindow } from "./booking-datetime.js";

describe("formatAvailabilityWindow", () => {
  it("formats a same-day Paris window", () => {
    expect(
      formatAvailabilityWindow("2026-07-16T06:00:00.000Z", "2026-07-16T17:00:00.000Z"),
    ).toMatch(/juil\.\s·\s08:00\s→\s19:00/);
  });

  it("formats a multi-day Paris window with hours", () => {
    const label = formatAvailabilityWindow("2026-07-16T06:00:00.000Z", "2026-07-18T17:00:00.000Z");
    expect(label).toContain("→");
    expect(label).toMatch(/08:00/);
    expect(label).toMatch(/19:00/);
    expect(label).toMatch(/juil\./);
  });
});
