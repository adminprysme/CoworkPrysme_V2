import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { discountFindOneMock, serviceFindMock } = vi.hoisted(() => ({
  discountFindOneMock: vi.fn(),
  serviceFindMock: vi.fn(),
}));

vi.mock("@coworkprysme/db", () => ({
  connectMongo: vi.fn().mockResolvedValue(undefined),
  getDiscountCodeModel: vi.fn().mockResolvedValue({
    findOne: discountFindOneMock,
  }),
  getServiceModel: vi.fn().mockResolvedValue({
    find: serviceFindMock,
  }),
}));

import {
  DISCOUNT_CODE_INVALID_MESSAGE,
  DISCOUNT_CODE_PREFERENTIAL_PENDING_MESSAGE,
} from "@coworkprysme/shared";

import { DiscountCodeValidationService } from "../discount-codes/discount-code-validation.service.js";
import type { AvailabilityService } from "./availability.service.js";
import { BookingPriceService } from "./booking-price.service.js";

const SPACE_ID = "507f1f77bcf86cd799439011";
const BUILDING_ID = "507f1f77bcf86cd799439012";
const SERVICE_ID = "507f1f77bcf86cd799439013";

const BASE_REQUEST = {
  spaceId: SPACE_ID,
  startAt: "2026-07-15T09:00:00.000+02:00",
  endAt: "2026-07-15T18:00:00.000+02:00",
  durationClass: "daily" as const,
  services: [],
};

describe("BookingPriceService", () => {
  let service: BookingPriceService;
  let availability: AvailabilityService;

  beforeEach(() => {
    vi.clearAllMocks();
    availability = {
      getSpaceById: vi.fn().mockResolvedValue({
        _id: { toString: () => SPACE_ID },
        name: "Salle Alpha",
        buildingId: { toString: () => BUILDING_ID },
        tariffs: [{ durationClass: "daily", priceHT: 10_000, vatRate: 20, enabled: true }],
      }),
    } as unknown as AvailabilityService;

    serviceFindMock.mockReturnValue({
      lean: () => ({
        exec: () => Promise.resolve([]),
      }),
    });

    service = new BookingPriceService(availability, new DiscountCodeValidationService());
  });

  it("rejects preferential codes with a pending-account message", async () => {
    discountFindOneMock.mockReturnValue({
      lean: () => ({
        exec: () =>
          Promise.resolve({
            code: "PREF001",
            kind: "preferential",
            discountType: "percentage",
            value: 10,
            perimeter: { appliesTo: "order" },
            status: "active",
            expiresAt: new Date("2027-01-01T00:00:00.000Z"),
            usedCount: 0,
          }),
      }),
    });

    await expect(
      service.computePrice({ ...BASE_REQUEST, discountCode: "PREF001" }),
    ).rejects.toMatchObject({
      response: { message: DISCOUNT_CODE_PREFERENTIAL_PENDING_MESSAGE },
    });
  });

  it("rejects scheduled promo codes with the generic invalid message", async () => {
    discountFindOneMock.mockReturnValue({
      lean: () => ({
        exec: () =>
          Promise.resolve({
            code: "FUTURE20",
            kind: "promo",
            discountType: "percentage",
            value: 20,
            perimeter: { appliesTo: "order" },
            status: "active",
            startsAt: new Date("2027-01-01T00:00:00.000Z"),
            expiresAt: new Date("2027-12-31T00:00:00.000Z"),
            usedCount: 0,
          }),
      }),
    });

    await expect(
      service.computePrice({ ...BASE_REQUEST, discountCode: "FUTURE20" }),
    ).rejects.toMatchObject({
      response: { message: DISCOUNT_CODE_INVALID_MESSAGE },
    });
  });

  it("applies order-level percentage discounts to the space line", async () => {
    discountFindOneMock.mockReturnValue({
      lean: () => ({
        exec: () =>
          Promise.resolve({
            code: "CODE20",
            kind: "promo",
            discountType: "percentage",
            value: 20,
            perimeter: { appliesTo: "order" },
            status: "active",
            expiresAt: new Date("2027-01-01T00:00:00.000Z"),
            usedCount: 0,
          }),
      }),
    });

    const result = await service.computePrice({ ...BASE_REQUEST, discountCode: "CODE20" });
    const spaceLine = result.lines.find((line) => line.kind === "space");

    expect(spaceLine?.discount).toBe(2_000);
    expect(result.discountTotal).toBe(2_000);
  });

  it("rejects missing required custom answers", async () => {
    serviceFindMock.mockReturnValue({
      lean: () => ({
        exec: () =>
          Promise.resolve([
            {
              _id: { toString: () => SERVICE_ID },
              key: "coffee",
              label: "Café",
              priceHT: 500,
              vatRate: 20,
              promoEligible: true,
              isGlobal: true,
              buildingIds: [],
              customQuestions: [
                {
                  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
                  label: "Nombre de tasses",
                  type: "number",
                  required: true,
                  order: 0,
                },
              ],
            },
          ]),
      }),
    });

    await expect(
      service.computePrice({
        ...BASE_REQUEST,
        services: [{ serviceId: SERVICE_ID, qty: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
