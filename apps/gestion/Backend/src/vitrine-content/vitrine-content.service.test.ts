import { mkdtemp, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { UploadsService } from "../uploads/uploads.service.js";
import { VitrineContentService } from "./vitrine-content.service.js";

const mockDoc = {
  _id: "singleton",
  heroImages: [] as string[],
  conceptImage: null,
  serviceImages: {
    roomService: null,
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

vi.mock("./vitrine-content.mapper.js", () => ({
  getOrCreateVitrineContentDocument: vi.fn(async () => structuredClone(mockDoc)),
  getServiceImageField: vi.fn(),
  mapVitrineContentToResponse: vi.fn((doc) => doc),
}));

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
    mockVitrineContentModel.findByIdAndUpdate.mockReset();
    vi.mocked(uploads.deleteVitrineImageFile).mockClear?.();
  });

  it("leaves the uploaded file on disk when findByIdAndUpdate fails", async () => {
    mockVitrineContentModel.findByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      }),
    });

    const deleteSpy = vi.spyOn(uploads, "deleteVitrineImageFile");

    await expect(service.uploadImage("hero", validPng)).rejects.toThrow();

    expect(deleteSpy).not.toHaveBeenCalled();

    const heroFiles = await readdir(path.join(tempDir, "vitrine", "hero"));
    expect(heroFiles.some((name) => name.endsWith(".webp"))).toBe(true);
  });
});
