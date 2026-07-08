import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const mockEnv = {
  UPLOAD_MAX_BYTES: 15 * 1024 * 1024,
  UPLOAD_MAX_DIMENSION_PX: 4096,
};

vi.mock("@coworkprysme/shared/server", () => ({
  parseGestionApiEnv: () => mockEnv,
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

import { BadRequestException } from "@nestjs/common";

import { UploadsService } from "./uploads.service.js";

describe("UploadsService image pipeline", () => {
  let service: UploadsService;
  let tempDir: string;
  let validPng: Buffer;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "uploads-service-"));
    service = new UploadsService();
    (service as unknown as { uploadsDir: string }).uploadsDir = tempDir;
    validPng = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("rejects a text file renamed as webp", async () => {
    const buffer = Buffer.from("plain text pretending to be an image");

    await expect(service.storeVitrineImage("hero", buffer)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.storeVitrineImage("hero", buffer)).rejects.toMatchObject({
      message: "Unsupported file type",
    });
  });

  it("stores vitrine images under vitrine/{slot}/{uuid}.webp", async () => {
    const fileId = "11111111-2222-4333-8444-555555555555";

    const { storageKey } = await service.storeVitrineImage("hero", validPng, fileId);

    expect(storageKey).toBe("vitrine/hero/11111111-2222-4333-8444-555555555555.webp");
    const absolutePath = path.join(tempDir, storageKey);
    const fileStat = await stat(absolutePath);
    expect(fileStat.isFile()).toBe(true);
    const header = (await readFile(absolutePath)).subarray(0, 4).toString("ascii");
    expect(header).toBe("RIFF");
  });

  it("does not roll back stored files on its own when callers fail afterward", async () => {
    const { storageKey } = await service.storeVitrineImage("hero", validPng);
    const absolutePath = path.join(tempDir, storageKey);

    await expect(async () => {
      throw new Error("simulated findByIdAndUpdate failure");
    }).rejects.toThrow("simulated findByIdAndUpdate failure");

    await expect(stat(absolutePath)).resolves.toSatisfy((fileStat) => fileStat.isFile());
  });
});
