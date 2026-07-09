import { ConflictException, ForbiddenException, BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UpdateBuildingRequest } from "@coworkprysme/shared";

import { BuildingsService } from "./buildings.service.js";

const BUILDING_ID = "507f1f77bcf86cd799439011";
const now = new Date("2026-01-01T12:00:00.000Z");

function leanBuilding(photos: Array<{ storageKey: string; order: number; isPrimary: boolean }>) {
  return {
    _id: BUILDING_ID,
    name: "Cowork Test",
    address: { street: "1 rue Test", zip: "69003", city: "Lyon", country: "FR" },
    coordinates: { lat: 45.76, lng: 4.86 },
    floors: [{ name: "RDC" }],
    accessibilityHours: [
      { day: "monday", is24h: false, open: "08:00", close: "19:00" },
      { day: "tuesday", is24h: false, open: "08:00", close: "19:00" },
      { day: "wednesday", is24h: false, open: "08:00", close: "19:00" },
      { day: "thursday", is24h: false, open: "08:00", close: "19:00" },
      { day: "friday", is24h: false, open: "08:00", close: "19:00" },
      { day: "saturday", is24h: false, open: "08:00", close: "13:00" },
      { day: "sunday", is24h: false, open: "00:00", close: "00:00" },
    ],
    receptionHours: [
      { day: "monday", is24h: false, open: "08:00", close: "19:00" },
      { day: "tuesday", is24h: false, open: "08:00", close: "19:00" },
      { day: "wednesday", is24h: false, open: "08:00", close: "19:00" },
      { day: "thursday", is24h: false, open: "08:00", close: "19:00" },
      { day: "friday", is24h: false, open: "08:00", close: "19:00" },
      { day: "saturday", is24h: false, open: "08:00", close: "13:00" },
      { day: "sunday", is24h: false, open: "00:00", close: "00:00" },
    ],
    concierge: { url: "https://example.com", accessCode: "1234" },
    photos,
    status: "active" as const,
    visibleOnVitrine: false,
    isDefaultVitrineBuilding: false,
    createdAt: now,
    updatedAt: now,
  };
}

function mutableBuilding(photos: Array<{ storageKey: string; order: number; isPrimary: boolean }>) {
  return {
    _id: BUILDING_ID,
    photos: [...photos],
    set: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    deleteOne: vi.fn().mockResolvedValue(undefined),
  };
}

const mockBuildingModel = {
  findById: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue({ modifiedCount: 1 }) }),
};

const mockSpaceModel = {
  countDocuments: vi.fn(),
};

vi.mock("@coworkprysme/db", () => ({
  connectMongo: vi.fn().mockResolvedValue(undefined),
  getBuildingModel: vi.fn(async () => mockBuildingModel),
  getSpaceModel: vi.fn(async () => mockSpaceModel),
}));

const mockGeocoding = {
  geocodeAddress: vi.fn().mockResolvedValue({ lat: 45.76, lng: 4.86 }),
};

const mockUploads = {
  getLimits: vi.fn().mockReturnValue({ UPLOAD_MAX_PHOTOS_PER_BUILDING: 15 }),
  deleteBuildingDirectory: vi.fn().mockResolvedValue(undefined),
  storeBuildingPhoto: vi.fn(),
  deletePhotoFile: vi.fn().mockResolvedValue(undefined),
};

function globalProfile() {
  return {
    scope: { buildingIds: [], spaceTypes: [] },
    permissions: { spaces: true },
  } as never;
}

function scopedProfile() {
  return {
    scope: { buildingIds: [BUILDING_ID], spaceTypes: [] },
    permissions: { spaces: true },
  } as never;
}

function fullBuildingUpdateRequest(
  overrides: Partial<UpdateBuildingRequest> = {},
): UpdateBuildingRequest {
  return {
    name: "Cowork Test",
    address: { street: "1 rue Test", postalCode: "69003", city: "Lyon", country: "France" },
    floors: [{ name: "RDC" }],
    status: "active",
    accessibilityHours: [
      { day: "monday", is24h: false, openTime: "08:00", closeTime: "19:00" },
      { day: "tuesday", is24h: false, openTime: "08:00", closeTime: "19:00" },
      { day: "wednesday", is24h: false, openTime: "08:00", closeTime: "19:00" },
      { day: "thursday", is24h: false, openTime: "08:00", closeTime: "19:00" },
      { day: "friday", is24h: false, openTime: "08:00", closeTime: "19:00" },
      { day: "saturday", is24h: false, openTime: "08:00", closeTime: "13:00" },
      { day: "sunday", is24h: false, openTime: "00:00", closeTime: "00:00" },
    ],
    receptionHours: [
      { day: "monday", is24h: false, openTime: "08:00", closeTime: "19:00" },
      { day: "tuesday", is24h: false, openTime: "08:00", closeTime: "19:00" },
      { day: "wednesday", is24h: false, openTime: "08:00", closeTime: "19:00" },
      { day: "thursday", is24h: false, openTime: "08:00", closeTime: "19:00" },
      { day: "friday", is24h: false, openTime: "08:00", closeTime: "19:00" },
      { day: "saturday", is24h: false, openTime: "08:00", closeTime: "13:00" },
      { day: "sunday", is24h: false, openTime: "00:00", closeTime: "00:00" },
    ],
    concierge: { link: "https://example.com", accessCode: "1234" },
    visibleOnVitrine: false,
    isDefaultVitrineBuilding: false,
    ...overrides,
  };
}

function mockFindById(mutableDoc: ReturnType<typeof mutableBuilding>, leanDoc = leanBuilding([])) {
  mockBuildingModel.findById.mockReturnValue({
    exec: vi.fn().mockResolvedValue(mutableDoc),
    lean: vi.fn().mockReturnValue({
      exec: vi.fn().mockResolvedValue(leanDoc),
    }),
  });
}

describe("BuildingsService", () => {
  let service: BuildingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    const doc = mutableBuilding([]);
    mockFindById(doc);
    service = new BuildingsService(mockGeocoding as never, mockUploads as never);
  });

  describe("delete", () => {
    it("blocks deletion when the building has spaces (active or archived)", async () => {
      mockSpaceModel.countDocuments.mockReturnValue({
        exec: vi.fn().mockResolvedValue(3),
      });

      await expect(service.delete(BUILDING_ID, globalProfile())).rejects.toMatchObject({
        response: {
          statusCode: 409,
          message:
            "Ce bâtiment contient 3 espace(s). Supprimez-les avant de supprimer le bâtiment.",
        },
      });

      expect(mockUploads.deleteBuildingDirectory).not.toHaveBeenCalled();
    });

    it("deletes the building when it has no spaces", async () => {
      const doc = mutableBuilding([]);
      mockFindById(doc);
      mockSpaceModel.countDocuments.mockReturnValue({
        exec: vi.fn().mockResolvedValue(0),
      });

      await service.delete(BUILDING_ID, globalProfile());

      expect(mockUploads.deleteBuildingDirectory).toHaveBeenCalledWith(BUILDING_ID);
      expect(doc.deleteOne).toHaveBeenCalled();
    });

    it("does not cascade-delete spaces or their photo directories", async () => {
      mockSpaceModel.countDocuments.mockReturnValue({
        exec: vi.fn().mockResolvedValue(1),
      });

      await expect(service.delete(BUILDING_ID, globalProfile())).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(mockUploads.deleteBuildingDirectory).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    const createInput = {
      name: "Test",
      address: { street: "1 rue Test", postalCode: "69003", city: "Lyon", country: "France" },
      floors: [{ name: "RDC" }],
      status: "active" as const,
      accessibilityHours: [
        { day: "monday" as const, is24h: false, openTime: "08:00", closeTime: "19:00" },
      ],
      receptionHours: [
        { day: "monday" as const, is24h: false, openTime: "08:00", closeTime: "19:00" },
      ],
      concierge: { link: "", accessCode: "" },
      visibleOnVitrine: false,
      isDefaultVitrineBuilding: false,
    };

    it("refuses creation for a scoped manager (no auto-assign)", async () => {
      await expect(service.create(createInput, scopedProfile())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(mockBuildingModel.create).not.toHaveBeenCalled();
    });
  });

  describe("updatePhotos", () => {
    it("deletes disk files for photos removed from the array", async () => {
      const keptKey = `buildings/${BUILDING_ID}/a1b2c3d4-e5f6-7890-abcd-ef1234567890.webp`;
      const removedKey = `buildings/${BUILDING_ID}/b2c3d4e5-f6a7-8901-bcde-f12345678901.webp`;
      const photos = [
        { storageKey: keptKey, order: 0, isPrimary: true },
        { storageKey: removedKey, order: 1, isPrimary: false },
      ];
      const doc = mutableBuilding(photos);
      mockFindById(doc, leanBuilding(photos));

      await service.updatePhotos(
        BUILDING_ID,
        {
          photos: [{ storageKey: keptKey, order: 0, isPrimary: true }],
        },
        globalProfile(),
      );

      expect(mockUploads.deletePhotoFile).toHaveBeenCalledWith(removedKey);
      expect(mockUploads.deletePhotoFile).not.toHaveBeenCalledWith(keptKey);
    });
  });

  describe("uploadPhoto", () => {
    it("removes the uploaded file when persisting to MongoDB fails", async () => {
      const storageKey = `buildings/${BUILDING_ID}/c3d4e5f6-a7b8-9012-cdef-123456789012.webp`;
      const doc = mutableBuilding([]);
      doc.save.mockRejectedValueOnce(new Error("save failed"));
      mockFindById(doc);
      mockUploads.storeBuildingPhoto.mockResolvedValue({ storageKey });

      await expect(
        service.uploadPhoto(BUILDING_ID, Buffer.from("x"), globalProfile()),
      ).rejects.toThrow("save failed");

      expect(mockUploads.deletePhotoFile).toHaveBeenCalledWith(storageKey);
    });
  });

  describe("update vitrine flags", () => {
    it("clears other default buildings when setting a new default", async () => {
      const doc = mutableBuilding([]);
      mockFindById(doc, leanBuilding([]));

      await service.update(
        BUILDING_ID,
        fullBuildingUpdateRequest({
          visibleOnVitrine: true,
          isDefaultVitrineBuilding: true,
        }),
        globalProfile(),
      );

      expect(mockBuildingModel.updateMany).toHaveBeenCalledWith(
        { _id: { $ne: BUILDING_ID }, isDefaultVitrineBuilding: true },
        { $set: { isDefaultVitrineBuilding: false } },
      );
    });

    it("rejects inactive building visible on vitrine", async () => {
      const doc = mutableBuilding([]);
      mockFindById(doc, leanBuilding([]));

      await expect(
        service.update(
          BUILDING_ID,
          fullBuildingUpdateRequest({
            status: "inactive",
            visibleOnVitrine: true,
          }),
          globalProfile(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockBuildingModel.updateMany).not.toHaveBeenCalled();
      expect(doc.save).not.toHaveBeenCalled();
    });

    it("auto-clears default when visibility is turned off", async () => {
      const doc = mutableBuilding([]);
      mockFindById(doc, leanBuilding([]));

      await service.update(
        BUILDING_ID,
        fullBuildingUpdateRequest({
          visibleOnVitrine: false,
          isDefaultVitrineBuilding: true,
        }),
        globalProfile(),
      );

      expect(doc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          visibleOnVitrine: false,
          isDefaultVitrineBuilding: false,
        }),
      );
      expect(mockBuildingModel.updateMany).not.toHaveBeenCalled();
    });
  });
});
