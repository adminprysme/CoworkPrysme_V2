import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMock } = vi.hoisted(() => ({
  findMock: vi.fn(),
}));

vi.mock("@coworkprysme/db", () => ({
  connectMongo: vi.fn().mockResolvedValue(undefined),
  getServiceModel: vi.fn().mockResolvedValue({
    find: findMock,
  }),
}));

import { DISCOUNT_CODE_INVALID_MESSAGE } from "@coworkprysme/shared";

import { DiscountCodeValidationService } from "./discount-code-validation.service.js";

describe("DiscountCodeValidationService", () => {
  let service: DiscountCodeValidationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DiscountCodeValidationService();
  });

  it("rejects buy_one_get_one on a non-promoEligible service using shared validation", async () => {
    findMock.mockReturnValue({
      lean: () => ({
        exec: () =>
          Promise.resolve([
            {
              key: "parking",
              label: "Parking",
              promoEligible: false,
              status: "active",
            },
          ]),
      }),
    });

    await expect(
      service.assertServiceTargets({
        discountType: "buy_one_get_one",
        perimeter: { appliesTo: "service", serviceKeys: ["parking"] },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects scheduled codes via assertApplicable with generic message", () => {
    const now = new Date("2026-07-10T12:00:00.000Z");

    expect(() =>
      service.assertApplicable(
        {
          status: "active",
          startsAt: new Date("2026-07-20T12:00:00.000Z"),
          expiresAt: new Date("2026-08-01T12:00:00.000Z"),
          usedCount: 0,
        },
        now,
      ),
    ).toThrow(BadRequestException);

    try {
      service.assertApplicable(
        {
          status: "active",
          startsAt: new Date("2026-07-20T12:00:00.000Z"),
          expiresAt: new Date("2026-08-01T12:00:00.000Z"),
          usedCount: 0,
        },
        now,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual({
        message: DISCOUNT_CODE_INVALID_MESSAGE,
      });
    }
  });
});
