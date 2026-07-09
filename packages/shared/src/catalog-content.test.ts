import { describe, expect, it } from "vitest";

import { computeStartingPriceHTCents, pickStartingPriceVatRate } from "./catalog-content.js";

describe("catalog-content helpers", () => {
  it("returns the lowest enabled tariff price in centimes", () => {
    expect(
      computeStartingPriceHTCents([
        { priceHT: 5000, enabled: true },
        { priceHT: 1999, enabled: true },
        { priceHT: 800, enabled: false },
      ]),
    ).toBe(1999);
  });

  it("returns null when no enabled tariffs exist", () => {
    expect(computeStartingPriceHTCents([{ priceHT: 5000, enabled: false }])).toBeNull();
  });

  it("picks the VAT rate matching the starting price", () => {
    const tariffs = [
      { priceHT: 5000, vatRate: 20, enabled: true },
      { priceHT: 1999, vatRate: 10, enabled: true },
    ];
    expect(pickStartingPriceVatRate(tariffs, 1999)).toBe(10);
  });
});
