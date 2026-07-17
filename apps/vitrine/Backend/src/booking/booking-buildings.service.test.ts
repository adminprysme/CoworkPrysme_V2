import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const { buildingFindMock, connectMongoMock } = vi.hoisted(() => ({
  buildingFindMock: vi.fn(),
  connectMongoMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@coworkprysme/db", () => ({
  connectMongo: connectMongoMock,
  getBuildingModel: vi.fn().mockResolvedValue({ find: buildingFindMock }),
  findActiveLockBySessionId: vi.fn(),
  acquireLock: vi.fn(),
  releaseLockById: vi.fn(),
  RangeOpeningHoursError: class RangeOpeningHoursError extends Error {},
  SlotLockConflictError: class SlotLockConflictError extends Error {},
  SlotUnavailableError: class SlotUnavailableError extends Error {},
}));

import type { AvailabilityService } from "./availability.service.js";
import { BookingService } from "./booking.service.js";
import type { DiscountCodeValidationService } from "../discount-codes/discount-code-validation.service.js";
import type { SlotGenerationService } from "./slot-generation.service.js";

const BUILDING_A = new Types.ObjectId("507f1f77bcf86cd799439012");
const BUILDING_B = new Types.ObjectId("507f1f77bcf86cd799439013");

describe("BookingService.listActiveBuildings", () => {
  let service: BookingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BookingService(
      {} as AvailabilityService,
      {} as SlotGenerationService,
      {} as DiscountCodeValidationService,
    );

    buildingFindMock.mockReturnValue({
      sort: () => ({
        lean: () => ({
          exec: () =>
            Promise.resolve([
              {
                _id: BUILDING_A,
                name: "Alpha Cowork",
                status: "active",
                address: { city: "Lyon" },
              },
              {
                _id: BUILDING_B,
                name: "Beta Cowork",
                status: "active",
                address: { city: "Villeurbanne" },
              },
            ]),
        }),
      }),
    });
  });

  it("lists active buildings only (no visibleOnVitrine filter), sorted by name", async () => {
    const result = await service.listActiveBuildings();

    expect(buildingFindMock).toHaveBeenCalledWith({ status: "active" });
    expect(buildingFindMock.mock.calls[0]?.[0]).not.toHaveProperty("visibleOnVitrine");
    expect(result.buildings).toEqual([
      { id: BUILDING_A.toString(), name: "Alpha Cowork", city: "Lyon" },
      { id: BUILDING_B.toString(), name: "Beta Cowork", city: "Villeurbanne" },
    ]);
  });
});
