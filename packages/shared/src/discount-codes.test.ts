import { describe, expect, it } from "vitest";

import {
  assertDiscountCodeApplicable,
  assertDiscountCodeDateRange,
  assertDiscountCodeServiceTargets,
  computeDiscountCodeDisplayStatus,
  DISCOUNT_CODE_DATE_RANGE_ERROR,
  DISCOUNT_CODE_INVALID_MESSAGE,
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

describe("assertDiscountCodeDateRange", () => {
  it("requires startsAt to be strictly before expiresAt", () => {
    const startsAt = new Date("2026-08-01T00:00:00.000Z");
    const expiresAt = new Date("2026-07-01T00:00:00.000Z");

    expect(() => assertDiscountCodeDateRange(startsAt, expiresAt)).toThrow(
      DISCOUNT_CODE_DATE_RANGE_ERROR,
    );
  });

  it("allows absent startsAt", () => {
    expect(() =>
      assertDiscountCodeDateRange(undefined, new Date("2026-12-01T00:00:00.000Z")),
    ).not.toThrow();
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

  it("returns scheduled when startsAt is in the future", () => {
    expect(
      computeDiscountCodeDisplayStatus(
        {
          status: "active",
          startsAt: new Date("2026-07-15T12:00:00.000Z"),
          expiresAt: new Date("2026-07-20T12:00:00.000Z"),
          usedCount: 0,
        },
        now,
      ),
    ).toBe("scheduled");
  });

  it("does not return active before startsAt even when other criteria match", () => {
    expect(
      computeDiscountCodeDisplayStatus(
        {
          status: "active",
          startsAt: new Date("2026-07-15T12:00:00.000Z"),
          expiresAt: new Date("2026-08-01T12:00:00.000Z"),
          maxUses: 100,
          usedCount: 0,
        },
        now,
      ),
    ).not.toBe("active");
  });

  it("returns active once startsAt is in the past", () => {
    expect(
      computeDiscountCodeDisplayStatus(
        {
          status: "active",
          startsAt: new Date("2026-07-01T12:00:00.000Z"),
          expiresAt: new Date("2026-08-01T12:00:00.000Z"),
          usedCount: 0,
        },
        now,
      ),
    ).toBe("active");
  });

  it("returns disabled before scheduled when status is disabled", () => {
    expect(
      computeDiscountCodeDisplayStatus(
        {
          status: "disabled",
          startsAt: new Date("2026-07-15T12:00:00.000Z"),
          expiresAt: new Date("2026-08-01T12:00:00.000Z"),
          usedCount: 0,
        },
        now,
      ),
    ).toBe("disabled");
  });

  it("returns expired before scheduled for inconsistent future start with past expiry", () => {
    expect(
      computeDiscountCodeDisplayStatus(
        {
          status: "active",
          startsAt: new Date("2026-08-01T12:00:00.000Z"),
          expiresAt: new Date("2026-07-05T12:00:00.000Z"),
          usedCount: 0,
        },
        now,
      ),
    ).toBe("expired");
  });
});

describe("assertDiscountCodeApplicable", () => {
  const now = new Date("2026-07-10T12:00:00.000Z");

  it("rejects scheduled codes with the generic invalid message", () => {
    expect(() =>
      assertDiscountCodeApplicable(
        {
          status: "active",
          startsAt: new Date("2026-07-15T12:00:00.000Z"),
          expiresAt: new Date("2026-08-01T12:00:00.000Z"),
          usedCount: 0,
        },
        now,
      ),
    ).toThrow(DISCOUNT_CODE_INVALID_MESSAGE);
  });

  it("allows codes without startsAt (non-regression)", () => {
    expect(() =>
      assertDiscountCodeApplicable(
        {
          status: "active",
          expiresAt: new Date("2026-08-01T12:00:00.000Z"),
          usedCount: 0,
        },
        now,
      ),
    ).not.toThrow();
  });

  it("allows codes whose startsAt is already reached", () => {
    expect(() =>
      assertDiscountCodeApplicable(
        {
          status: "active",
          startsAt: new Date("2026-07-01T12:00:00.000Z"),
          expiresAt: new Date("2026-08-01T12:00:00.000Z"),
          usedCount: 0,
        },
        now,
      ),
    ).not.toThrow();
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
