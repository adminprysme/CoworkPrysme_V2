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
});
