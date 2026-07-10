import { describe, expect, it } from "vitest";

import {
  assertDiscountCodeServiceTargets,
  computeDiscountCodeDisplayStatus,
  DiscountCodeValidationError,
  mapFixedDiscountEurosToDb,
  mapFixedDiscountDbToEuros,
} from "./discount-codes.js";
import { eurosToCents, centsToEuros } from "./money.js";
import { mapServicePriceDbToEuros, mapServicePriceEurosToDb } from "./services.js";

describe("assertDiscountCodeServiceTargets", () => {
  const catalog = [
    { key: "cafe-premium", label: "Café premium", promoEligible: true, status: "active" as const },
    { key: "parking", label: "Parking", promoEligible: false, status: "active" as const },
  ];

  it("rejects buy_one_get_one targeting a non-promoEligible service", () => {
    expect(() =>
      assertDiscountCodeServiceTargets(
        {
          discountType: "buy_one_get_one",
          perimeter: { appliesTo: "service", serviceKeys: ["parking"] },
        },
        catalog,
      ),
    ).toThrow(DiscountCodeValidationError);

    expect(() =>
      assertDiscountCodeServiceTargets(
        {
          discountType: "buy_one_get_one",
          perimeter: { appliesTo: "service", serviceKeys: ["parking"] },
        },
        catalog,
      ),
    ).toThrow(/n'est pas éligible/);
  });

  it("allows percentage discounts on non-promoEligible services", () => {
    expect(() =>
      assertDiscountCodeServiceTargets(
        {
          discountType: "percentage",
          perimeter: { appliesTo: "service", serviceKeys: ["parking"] },
        },
        catalog,
      ),
    ).not.toThrow();
  });

  it("rejects space perimeter for promo codes", () => {
    expect(() =>
      assertDiscountCodeServiceTargets(
        {
          discountType: "percentage",
          perimeter: { appliesTo: "space", serviceKeys: [] },
        },
        catalog,
      ),
    ).toThrow(/espace/);
  });
});

describe("computeDiscountCodeDisplayStatus", () => {
  const now = new Date("2026-07-10T12:00:00.000Z");

  it("returns expired when expiresAt is in the past", () => {
    expect(
      computeDiscountCodeDisplayStatus(
        {
          status: "active",
          expiresAt: new Date("2026-07-09T12:00:00.000Z"),
          usedCount: 0,
        },
        now,
      ),
    ).toBe("expired");
  });

  it("returns exhausted when maxUses is reached", () => {
    expect(
      computeDiscountCodeDisplayStatus(
        {
          status: "active",
          expiresAt: new Date("2026-07-20T12:00:00.000Z"),
          maxUses: 10,
          usedCount: 10,
        },
        now,
      ),
    ).toBe("exhausted");
  });

  it("returns active for valid active codes", () => {
    expect(
      computeDiscountCodeDisplayStatus(
        {
          status: "active",
          expiresAt: new Date("2026-07-20T12:00:00.000Z"),
          maxUses: 10,
          usedCount: 2,
        },
        now,
      ),
    ).toBe("active");
  });
});

describe("service and discount euro conversions", () => {
  it("converts service prices without float drift", () => {
    expect(mapServicePriceEurosToDb(19.99)).toBe(1999);
    expect(mapServicePriceDbToEuros(1999)).toBe(19.99);
    expect(eurosToCents(0.1 + 0.2)).toBe(30);
    expect(centsToEuros(30)).toBe(0.3);
  });

  it("converts fixed discount amounts to centimes", () => {
    expect(mapFixedDiscountEurosToDb(5)).toBe(500);
    expect(mapFixedDiscountDbToEuros(500)).toBe(5);
  });
});
