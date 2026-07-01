import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import {
  buildBuildingPhotoStorageKey,
  isValidBuildingPhotoStorageKey,
  parseGestionApiEnv,
  resolveStorageKeyAbsolutePath,
  resolveUploadsDir,
} from "@coworkprysme/shared";
import { fileTypeFromBuffer } from "file-type";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

@Injectable()
export class UploadsService implements OnModuleInit {
  private uploadsDir = "";

  async onModuleInit(): Promise<void> {
    const env = parseGestionApiEnv();
    this.uploadsDir = resolveUploadsDir(process.env, process.cwd());
    if (env.UPLOADS_DIR?.trim()) {
      this.uploadsDir = path.resolve(env.UPLOADS_DIR.trim());
    }
    await mkdir(this.uploadsDir, { recursive: true });
  }

  getUploadsDir(): string {
    return this.uploadsDir;
  }

  getLimits() {
    return parseGestionApiEnv();
  }

  resolveReadablePath(storageKey: string): string {
    const absolutePath = resolveStorageKeyAbsolutePath(this.uploadsDir, storageKey);
    if (!absolutePath) {
      throw new NotFoundException();
    }
    return absolutePath;
  }

  async assertReadableFile(storageKey: string): Promise<string> {
    const absolutePath = this.resolveReadablePath(storageKey);
    try {
      const fileStat = await stat(absolutePath);
      if (!fileStat.isFile()) {
        throw new NotFoundException();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new NotFoundException();
      }
      throw error;
    }
    return absolutePath;
  }

  async storeBuildingPhoto(buildingId: string, buffer: Buffer): Promise<{ storageKey: string }> {
    const limits = this.getLimits();

    if (buffer.length === 0) {
      throw new BadRequestException("Empty file");
    }

    if (buffer.length > limits.UPLOAD_MAX_BYTES) {
      throw new BadRequestException("File exceeds maximum size");
    }

    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !ACCEPTED_MIME_TYPES.has(detected.mime)) {
      throw new BadRequestException("Unsupported file type");
    }

    const fileId = crypto.randomUUID();
    const storageKey = buildBuildingPhotoStorageKey(buildingId, fileId);
    if (!isValidBuildingPhotoStorageKey(storageKey)) {
      throw new BadRequestException("Invalid storage key");
    }

    const absolutePath = resolveStorageKeyAbsolutePath(this.uploadsDir, storageKey);
    if (!absolutePath) {
      throw new BadRequestException("Invalid storage key");
    }
    await mkdir(path.dirname(absolutePath), { recursive: true });

    await sharp(buffer)
      .rotate()
      .resize({
        width: limits.UPLOAD_MAX_DIMENSION_PX,
        height: limits.UPLOAD_MAX_DIMENSION_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toFile(absolutePath);

    return { storageKey };
  }

  async deletePhotoFile(storageKey: string): Promise<void> {
    if (!isValidBuildingPhotoStorageKey(storageKey)) {
      return;
    }

    const absolutePath = resolveStorageKeyAbsolutePath(this.uploadsDir, storageKey);
    if (!absolutePath) {
      return;
    }

    try {
      await rm(absolutePath, { force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  async deleteBuildingDirectory(buildingId: string): Promise<void> {
    const buildingDir = path.resolve(this.uploadsDir, "buildings", buildingId);
    const uploadsPrefix = this.uploadsDir.endsWith(path.sep)
      ? this.uploadsDir
      : `${this.uploadsDir}${path.sep}`;

    if (!buildingDir.startsWith(uploadsPrefix)) {
      return;
    }

    await rm(buildingDir, { recursive: true, force: true });
  }
}
