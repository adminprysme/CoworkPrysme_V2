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

import { BookingCatalogService } from "./booking-catalog.service.js";

describe("BookingCatalogService", () => {
  let service: BookingCatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BookingCatalogService();
  });

  it("lists only active services available for the requested building", async () => {
    const sortMock = vi.fn().mockReturnValue({
      lean: () => ({
        exec: () =>
          Promise.resolve([
            {
              _id: { toString: () => "507f1f77bcf86cd799439011" },
              key: "coffee",
              label: "Café",
              priceHT: 500,
              vatRate: 20,
              promoEligible: true,
              customQuestions: [],
              isGlobal: true,
            },
          ]),
      }),
    });

    findMock.mockReturnValue({ sort: sortMock });

    const result = await service.listServicesForBuilding({
      buildingId: "507f1f77bcf86cd799439012",
    });

    expect(findMock).toHaveBeenCalledWith({
      status: "active",
      $or: [{ isGlobal: true }, { buildingIds: expect.anything() }],
    });
    expect(result.services).toHaveLength(1);
    expect(result.services[0]?.key).toBe("coffee");
  });
});
