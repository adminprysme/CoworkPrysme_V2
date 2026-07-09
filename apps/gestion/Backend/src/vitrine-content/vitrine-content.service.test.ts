import { access, mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("@coworkprysme/shared/server", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    parseGestionApiEnv: () => ({
      UPLOAD_MAX_BYTES: 15 * 1024 * 1024,
      UPLOAD_MAX_DIMENSION_PX: 4096,
    }),
    resolveUploadsDir: (_env: unknown, cwd: string) => path.join(cwd, "uploads-test"),
  };
});

import { UploadsService } from "../uploads/uploads.service.js";
import { VitrineContentService } from "./vitrine-content.service.js";

const mockDoc = {
  _id: "singleton",
  heroImages: [] as string[],
  conceptImage: null as string | null,
  serviceImages: {
    roomService: null as string | null,
    afterwork: null,
    conciergerie: null,
  },
  marquee: {
    enabled: true,
    text: "Le Tramway T9 arrive au pied de l'immeuble à la fin de l'automne 2026",
  },
  featuredSpaceIds: [],
};

const mockVitrineContentModel = {
  findById: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  create: vi.fn(),
};

vi.mock("@coworkprysme/db", () => ({
  connectMongo: vi.fn().mockResolvedValue(undefined),
  getVitrineContentModel: vi.fn(async () => mockVitrineContentModel),
}));

vi.mock("./vitrine-content.mapper.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    getOrCreateVitrineContentDocument: vi.fn(async () => structuredClone(mockDoc)),
    mapVitrineContentToResponse: vi.fn((doc) => doc),
  };
});

function mockFailedDbUpdate() {
  mockVitrineContentModel.findByIdAndUpdate.mockReturnValue({
    lean: vi.fn().mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    }),
  });
}

function mockSuccessfulDbUpdate() {
  mockVitrineContentModel.findByIdAndUpdate.mockImplementation((_id, update) => ({
    lean: vi.fn().mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        ...structuredClone(mockDoc),
        ...update,
      }),
    }),
  }));
}

async function seedFile(uploadsDir: string, storageKey: string) {
  const absolute = path.join(uploadsDir, storageKey);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, "seed");
}

describe("VitrineContentService upload rollback", () => {
  let uploads: UploadsService;
  let service: VitrineContentService;
  let tempDir: string;
  let validPng: Buffer;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "vitrine-upload-"));
    uploads = new UploadsService();
    (uploads as unknown as { uploadsDir: string }).uploadsDir = tempDir;
    service = new VitrineContentService(uploads);
    validPng = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    mockDoc.heroImages = [];
    mockDoc.conceptImage = null;
    mockDoc.serviceImages = {
      roomService: null,
      afterwork: null,
      conciergerie: null,
    };
    mockVitrineContentModel.findByIdAndUpdate.mockReset();
  });

  it("rolls back the new hero file when findByIdAndUpdate fails", async () => {
    mockFailedDbUpdate();
    const deleteSpy = vi.spyOn(uploads, "deleteVitrineImageFile");

    await expect(service.uploadImage("hero", validPng)).rejects.toThrow();

    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy.mock.calls[0]?.[0]).toMatch(/^vitrine\/hero\/[0-9a-f-]{36}\.webp$/);

    const heroFiles = await readdir(path.join(tempDir, "vitrine", "hero"));
    expect(heroFiles.some((name) => name.endsWith(".webp"))).toBe(false);
  });

  it("rolls back the new concept file but keeps the previous one when DB update fails", async () => {
    const previousKey = "vitrine/concept/00000000-0000-4000-8000-000000000001.webp";
    mockDoc.conceptImage = previousKey;
    await seedFile(tempDir, previousKey);
    mockFailedDbUpdate();
    const deleteSpy = vi.spyOn(uploads, "deleteVitrineImageFile");

    await expect(service.uploadImage("concept", validPng)).rejects.toThrow();

    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy.mock.calls[0]?.[0]).toMatch(/^vitrine\/concept\/[0-9a-f-]{36}\.webp$/);
    expect(deleteSpy.mock.calls[0]?.[0]).not.toBe(previousKey);

    await expect(access(path.join(tempDir, previousKey))).resolves.toBeUndefined();
    const conceptFiles = await readdir(path.join(tempDir, "vitrine", "concept"));
    expect(conceptFiles).toEqual(["00000000-0000-4000-8000-000000000001.webp"]);
  });

  it("rolls back the new service file but keeps the previous one when DB update fails", async () => {
    const previousKey = "vitrine/room-service/00000000-0000-4000-8000-000000000002.webp";
    mockDoc.serviceImages.roomService = previousKey;
    await seedFile(tempDir, previousKey);
    mockFailedDbUpdate();
    const deleteSpy = vi.spyOn(uploads, "deleteVitrineImageFile");

    await expect(service.uploadImage("room-service", validPng)).rejects.toThrow();

    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy.mock.calls[0]?.[0]).toMatch(/^vitrine\/room-service\/[0-9a-f-]{36}\.webp$/);

    await expect(access(path.join(tempDir, previousKey))).resolves.toBeUndefined();
  });
});

describe("VitrineContentService PATCH heroImages orphan cleanup", () => {
  let uploads: UploadsService;
  let service: VitrineContentService;
  let tempDir: string;

  const keptKey = "vitrine/hero/11111111-1111-4111-8111-111111111111.webp";
  const removedKey = "vitrine/hero/22222222-2222-4222-8222-222222222222.webp";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "vitrine-patch-"));
    uploads = new UploadsService();
    (uploads as unknown as { uploadsDir: string }).uploadsDir = tempDir;
    service = new VitrineContentService(uploads);

    mockDoc.heroImages = [keptKey, removedKey];
    mockDoc.conceptImage = null;
    mockDoc.serviceImages = {
      roomService: null,
      afterwork: null,
      conciergerie: null,
    };
    mockVitrineContentModel.findByIdAndUpdate.mockReset();
    await seedFile(tempDir, keptKey);
    await seedFile(tempDir, removedKey);
  });

  it("deletes removed hero files from disk after a successful PATCH", async () => {
    mockSuccessfulDbUpdate();

    await service.updateContent({ heroImages: [keptKey] });

    await expect(access(path.join(tempDir, keptKey))).resolves.toBeUndefined();
    await expect(access(path.join(tempDir, removedKey))).rejects.toThrow();

    const heroFiles = await readdir(path.join(tempDir, "vitrine", "hero"));
    expect(heroFiles).toEqual(["11111111-1111-4111-8111-111111111111.webp"]);
  });

  it("keeps removed hero files on disk when the Mongo update fails", async () => {
    mockFailedDbUpdate();
    const deleteSpy = vi.spyOn(uploads, "deleteVitrineImageFile");

    await expect(service.updateContent({ heroImages: [keptKey] })).rejects.toThrow();

    expect(deleteSpy).not.toHaveBeenCalled();
    await expect(access(path.join(tempDir, removedKey))).resolves.toBeUndefined();
    const heroFiles = await readdir(path.join(tempDir, "vitrine", "hero"));
    expect(heroFiles).toHaveLength(2);
  });
});
