import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const { buildingFindMock, spaceFindMock, connectMongoMock } = vi.hoisted(() => ({
  buildingFindMock: vi.fn(),
  spaceFindMock: vi.fn(),
  connectMongoMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@coworkprysme/db", () => ({
  connectMongo: connectMongoMock,
  getBuildingModel: vi.fn().mockResolvedValue({ find: buildingFindMock }),
  getSpaceModel: vi.fn().mockResolvedValue({ find: spaceFindMock }),
  assertRangeAvailable: vi.fn(),
  fetchRangeBlockingCache: vi.fn(),
  isRangeBlocked: vi.fn(),
  isRangeBlockedWithCache: vi.fn(),
}));

import { AvailabilityService } from "./availability.service.js";

const BUILDING_ID = new Types.ObjectId("507f1f77bcf86cd799439012");
const SPACE_ID = new Types.ObjectId("507f1f77bcf86cd799439011");

describe("AvailabilityService.getCandidateSpaces", () => {
  let service: AvailabilityService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AvailabilityService();

    buildingFindMock.mockReturnValue({
      lean: () => ({
        exec: () => Promise.resolve([{ _id: BUILDING_ID, status: "active" }]),
      }),
    });

    spaceFindMock.mockReturnValue({
      lean: () => ({
        exec: () =>
          Promise.resolve([
            {
              _id: SPACE_ID,
              buildingId: BUILDING_ID,
              name: "FOCUS",
              capacity: 15,
              type: "meeting_room",
              status: "active",
            },
          ]),
      }),
    });
  });

  it("filters buildings by status active only (not visibleOnVitrine)", async () => {
    await service.getCandidateSpaces({
      spaceType: "meeting_room",
      partySize: 4,
    });

    expect(buildingFindMock).toHaveBeenCalledTimes(1);
    const buildingQuery = buildingFindMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(buildingQuery).toEqual({ status: "active" });
    expect(buildingQuery).not.toHaveProperty("visibleOnVitrine");
  });

  it("still scopes spaces to active buildings matching search filters", async () => {
    await service.getCandidateSpaces({
      spaceType: "meeting_room",
      partySize: 4,
      buildingId: BUILDING_ID.toString(),
      floor: "1",
    });

    expect(buildingFindMock).toHaveBeenCalledWith({
      status: "active",
      _id: BUILDING_ID,
    });
    expect(spaceFindMock).toHaveBeenCalledWith({
      buildingId: { $in: [BUILDING_ID] },
      status: "active",
      type: "meeting_room",
      capacity: { $gte: 4 },
      floor: "1",
    });
  });

  it("without buildingId does not constrain the building _id", async () => {
    await service.getCandidateSpaces({
      spaceType: "meeting_room",
      partySize: 2,
    });

    expect(buildingFindMock).toHaveBeenCalledWith({ status: "active" });
    expect(buildingFindMock.mock.calls[0]?.[0]).not.toHaveProperty("_id");
  });
});
