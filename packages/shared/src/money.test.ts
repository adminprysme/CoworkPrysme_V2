import { describe, expect, it } from "vitest";

import {
  centsToEuros,
  computeTtcCents,
  eurosToCents,
  formatCentsAsEuroString,
  isValidEuroAmount,
} from "./money.js";

describe("money", () => {
  it("converts 19.99 € to 1999 centimes and back without drift", () => {
    const cents = eurosToCents(19.99);
    expect(cents).toBe(1999);
    expect(centsToEuros(cents)).toBe(19.99);
    expect(formatCentsAsEuroString(cents)).toBe("19.99");
  });

  it("converts 20.00 € to 2000 centimes and back", () => {
    const cents = eurosToCents(20);
    expect(cents).toBe(2000);
    expect(centsToEuros(cents)).toBe(20);
    expect(formatCentsAsEuroString(cents)).toBe("20.00");
  });

  it("avoids classic float pitfalls (0.1 + 0.2)", () => {
    expect(eurosToCents(0.1 + 0.2)).toBe(30);
    expect(centsToEuros(30)).toBe(0.3);
  });

  it("validates euro amounts with at most 2 decimals", () => {
    expect(isValidEuroAmount(12.5)).toBe(true);
    expect(isValidEuroAmount(12.555)).toBe(false);
    expect(isValidEuroAmount(-1)).toBe(false);
  });

  it("computes indicative TTC in centimes", () => {
    expect(computeTtcCents(10000, 20)).toBe(12000);
    expect(computeTtcCents(1999, 20)).toBe(2399);
  });
});
