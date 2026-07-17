import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const { buildingFindMock, connectMongoMock } = vi.hoisted(() => ({
  buildingFindMock: vi.fn(),
  connectMongoMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@coworkprysme/db", () => ({
  connectMongo: connectMongoMock,
  getBuildingModel: vi.fn().mockResolvedValue({ find: buildingFindMock }),
  getSpaceModel: vi.fn(),
}));

import { CatalogContentService } from "./catalog-content.service.js";

const BUILDING_ID = new Types.ObjectId("507f1f77bcf86cd799439012");

describe("CatalogContentService (vitrine catalogue — visibleOnVitrine retained)", () => {
  let service: CatalogContentService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PUBLIC_API_ORIGIN = "http://127.0.0.1:8002";
    service = new CatalogContentService();

    buildingFindMock.mockReturnValue({
      sort: () => ({
        lean: () => ({
          exec: () =>
            Promise.resolve([
              {
                _id: BUILDING_ID,
                name: "Cowork GERLAND",
                status: "active",
                visibleOnVitrine: true,
                isDefaultVitrineBuilding: true,
                seo: { slug: "cowork-gerland" },
                address: { city: "Lyon", street: "x", postalCode: "69007", country: "FR" },
                photos: [],
              },
            ]),
        }),
      }),
    });
  });

  it("listBuildings still queries visibleOnVitrine: true + status active", async () => {
    await service.listBuildings();

    expect(buildingFindMock).toHaveBeenCalledWith({
      visibleOnVitrine: true,
      status: "active",
    });
  });
});
