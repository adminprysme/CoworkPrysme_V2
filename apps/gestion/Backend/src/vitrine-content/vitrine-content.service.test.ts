import { access, mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("@coworkprysme/shared/server", () => ({
  parseGestionApiEnv: () => ({
    UPLOAD_MAX_BYTES: 15 * 1024 * 1024,
    UPLOAD_MAX_DIMENSION_PX: 4096,
  }),
  resolveUploadsDir: (_env: unknown, cwd: string) => path.join(cwd, "uploads-test"),
  resolveStorageKeyAbsolutePath: (uploadsDir: string, storageKey: string) => {
    const absoluteUploads = path.resolve(uploadsDir);
    const absoluteTarget = path.resolve(absoluteUploads, storageKey);
    const uploadsPrefix = absoluteUploads.endsWith(path.sep)
      ? absoluteUploads
      : `${absoluteUploads}${path.sep}`;
    if (!absoluteTarget.startsWith(uploadsPrefix)) {
      return null;
    }
    return absoluteTarget;
  },
}));

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
    const previousKey = "vitrine/concept/previous-00000000-0000-4000-8000-000000000001.webp";
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
    expect(conceptFiles).toEqual(["previous-00000000-0000-4000-8000-000000000001.webp"]);
  });

  it("rolls back the new service file but keeps the previous one when DB update fails", async () => {
    const previousKey = "vitrine/room-service/previous-00000000-0000-4000-8000-000000000002.webp";
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
