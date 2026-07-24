import {
  DISCOUNT_CODE_INVALID_MESSAGE,
  DISCOUNT_CODE_PREFERENTIAL_PENDING_MESSAGE,
} from "@coworkprysme/shared";
import { describe, expect, it } from "vitest";

import { shouldPreservePriceOnPromoError } from "./booking-price-state";

describe("shouldPreservePriceOnPromoError", () => {
  const baseRequest = {
    spaceId: "6a4fa8240a137dd59bf824fc",
    startAt: "2026-07-18T06:00:00.000Z",
    endAt: "2026-07-18T17:00:00.000Z",
    services: [],
  };

  it("preserves price when a discount code was sent and the API rejects it", () => {
    expect(
      shouldPreservePriceOnPromoError(
        { ...baseRequest, discountCode: "NOTREAL" },
        "Code non valide",
      ),
    ).toBe(true);
  });

  it("preserves price for preferential pending message", () => {
    expect(
      shouldPreservePriceOnPromoError(
        { ...baseRequest, discountCode: "PREF123" },
        DISCOUNT_CODE_PREFERENTIAL_PENDING_MESSAGE,
      ),
    ).toBe(true);
  });

  it("does not preserve price for non-promo errors", () => {
    expect(
      shouldPreservePriceOnPromoError(
        { ...baseRequest, discountCode: "NOTREAL" },
        "Tarif indisponible pour cet espace",
      ),
    ).toBe(false);
  });

  it("does not preserve price when no discount code was sent", () => {
    expect(shouldPreservePriceOnPromoError(baseRequest, DISCOUNT_CODE_INVALID_MESSAGE)).toBe(false);
  });
});
