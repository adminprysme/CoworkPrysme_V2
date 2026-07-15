import { ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServicesService } from "./services.service.js";

const SERVICE_ID = "607f1f77bcf86cd799439021";
const BUILDING_A = "507f1f77bcf86cd799439011";
const BUILDING_B = "507f1f77bcf86cd799439012";

function objectId(id: string) {
  return { toString: () => id };
}

const adminProfile = {
  role: "admin" as const,
  scope: { buildingIds: [] as Array<{ toString(): string }>, spaceTypes: [] as string[] },
};

const managerProfile = {
  role: "manager" as const,
  scope: { buildingIds: [objectId(BUILDING_A)], spaceTypes: [] as string[] },
};

function baseService(overrides: Record<string, unknown> = {}) {
  return {
    _id: objectId(SERVICE_ID),
    key: "restauration",
    label: "Restauration",
    priceHT: 5000,
    vatRate: 20,
    promoEligible: false,
    status: "active" as const,
    customQuestions: [],
    isGlobal: true,
    buildingIds: [] as Array<{ toString(): string }>,
    createdAt: new Date("2026-01-01T12:00:00.000Z"),
    updatedAt: new Date("2026-01-01T12:00:00.000Z"),
    save: vi.fn().mockResolvedValue(undefined),
    deleteOne: vi.fn().mockResolvedValue(undefined),
    toObject: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

const mockServiceModel = {
  find: vi.fn(),
  findById: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
};

const mockBuildingModel = {
  find: vi
    .fn()
    .mockReturnValue({ lean: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue([]) }) }),
};

vi.mock("@coworkprysme/db", () => ({
  connectMongo: vi.fn().mockResolvedValue(undefined),
  getServiceModel: vi.fn(async () => mockServiceModel),
  getBuildingModel: vi.fn(async () => mockBuildingModel),
}));

const mockUploads = {
  storeServicePhoto: vi.fn(),
  deletePhotoFile: vi.fn(),
  deleteServiceDirectory: vi.fn(),
};

describe("ServicesService access rules", () => {
  let service: ServicesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ServicesService(mockUploads as never);
  });

  it("rejects manager creating a global service (T1)", async () => {
    await expect(
      service.create(
        {
          label: "Global",
          priceEurosHT: 10,
          vatRate: 20,
          promoEligible: false,
          status: "active",
          customQuestions: [],
          isGlobal: true,
          buildingIds: [],
        },
        managerProfile as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects manager attaching a building outside scope (T2)", async () => {
    await expect(
      service.create(
        {
          label: "Local",
          priceEurosHT: 10,
          vatRate: 20,
          promoEligible: false,
          status: "active",
          customQuestions: [],
          isGlobal: false,
          buildingIds: [BUILDING_B],
        },
        managerProfile as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows manager price-only update on global service and rejects label (T3)", async () => {
    const existing = baseService({ isGlobal: true, buildingIds: [] });
    mockServiceModel.findById.mockReturnValue({ exec: vi.fn().mockResolvedValue(existing) });

    await expect(
      service.update(SERVICE_ID, { label: "Nouveau nom" }, managerProfile as never),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.update(SERVICE_ID, { priceEurosHT: 99.99 }, managerProfile as never),
    ).resolves.toMatchObject({
      priceEurosHT: 99.99,
    });
  });

  it("allows admin unrestricted update on global service (T4)", async () => {
    const existing = baseService({ isGlobal: true, buildingIds: [] });
    mockServiceModel.findById.mockReturnValue({ exec: vi.fn().mockResolvedValue(existing) });

    await expect(
      service.update(
        SERVICE_ID,
        { label: "Nouveau nom", promoEligible: true },
        adminProfile as never,
      ),
    ).resolves.toMatchObject({
      label: "Nouveau nom",
      promoEligible: true,
    });
  });
});
