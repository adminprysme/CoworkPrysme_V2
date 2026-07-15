import { beforeEach, describe, expect, it, vi } from "vitest";

const { findActiveLockBySessionIdMock, connectMongoMock } = vi.hoisted(() => ({
  findActiveLockBySessionIdMock: vi.fn(),
  connectMongoMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@coworkprysme/db", () => ({
  connectMongo: connectMongoMock,
  findActiveLockBySessionId: findActiveLockBySessionIdMock,
  acquireLock: vi.fn(),
  releaseLockById: vi.fn(),
  getBuildingModel: vi.fn(),
  RangeOpeningHoursError: class RangeOpeningHoursError extends Error {},
  SlotLockConflictError: class SlotLockConflictError extends Error {},
  SlotUnavailableError: class SlotUnavailableError extends Error {},
}));

import { Types } from "mongoose";

import type { AvailabilityService } from "./availability.service.js";
import { BookingService } from "./booking.service.js";
import type { DiscountCodeValidationService } from "../discount-codes/discount-code-validation.service.js";
import type { SlotGenerationService } from "./slot-generation.service.js";

const SPACE_ID = new Types.ObjectId("507f1f77bcf86cd799439011");
const BUILDING_ID = new Types.ObjectId("507f1f77bcf86cd799439012");
const LOCK_ID = new Types.ObjectId("507f1f77bcf86cd799439013");

describe("BookingService.getActiveLock", () => {
  let service: BookingService;
  let availability: AvailabilityService;

  beforeEach(() => {
    vi.clearAllMocks();

    availability = {
      getSpaceById: vi.fn().mockResolvedValue({
        _id: SPACE_ID,
        name: "FOCUS",
        seo: { slug: "focus" },
        buildingId: BUILDING_ID,
        floor: null,
        capacity: 15,
        type: "meeting_room",
        equipments: [{ label: "Wifi" }],
        photos: [],
        tariffs: [{ durationClass: "daily", priceHT: 18_000, vatRate: 20, enabled: true }],
      }),
    } as unknown as AvailabilityService;

    service = new BookingService(
      availability,
      {} as SlotGenerationService,
      {} as DiscountCodeValidationService,
    );

    vi.spyOn(
      service as unknown as {
        getBuildingMap: BookingService["getBuildingMap"];
      },
      "getBuildingMap",
    ).mockResolvedValue(
      new Map([
        [
          BUILDING_ID.toString(),
          {
            _id: BUILDING_ID,
            name: "Cowork GERLAND",
            address: { city: "Lyon" },
            visibleOnVitrine: true,
            status: "active",
          },
        ],
      ]),
    );
  });

  it("returns null lock when the session has no active lock", async () => {
    findActiveLockBySessionIdMock.mockResolvedValue(null);

    const result = await service.getActiveLock("session-a");

    expect(result.lock).toBeNull();
    expect(result.space).toBeNull();
  });

  it("returns lock and space details for the owning session", async () => {
    const startAt = new Date("2026-07-20T06:00:00.000Z");
    const endAt = new Date("2026-07-20T17:00:00.000Z");
    const expiresAt = new Date("2026-07-20T06:10:00.000Z");

    findActiveLockBySessionIdMock.mockResolvedValue({
      _id: LOCK_ID,
      spaceId: SPACE_ID,
      startAt,
      endAt,
      expiresAt,
      sessionId: "session-a",
      partySize: 4,
      durationClass: "daily",
    });

    const result = await service.getActiveLock("session-a");

    expect(result.lock).toMatchObject({
      lockId: LOCK_ID.toString(),
      spaceId: SPACE_ID.toString(),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
    expect(result.space?.name).toBe("FOCUS");
    expect(result.partySize).toBe(4);
    expect(result.durationClass).toBe("daily");
  });

  it("does not expose a lock to another session id query", async () => {
    findActiveLockBySessionIdMock.mockResolvedValue(null);

    const result = await service.getActiveLock("other-session");

    expect(findActiveLockBySessionIdMock).toHaveBeenCalledWith("other-session");
    expect(result.lock).toBeNull();
  });
});
