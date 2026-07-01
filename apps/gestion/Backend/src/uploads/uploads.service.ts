import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import {
  buildEntityPhotoStorageKey,
  isValidEntityPhotoStorageKey,
  type UploadEntityType,
} from "@coworkprysme/shared";
import {
  parseGestionApiEnv,
  resolveStorageKeyAbsolutePath,
  resolveUploadsDir,
} from "@coworkprysme/shared/server";
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

  async storePhoto(
    entityType: UploadEntityType,
    entityId: string,
    buffer: Buffer,
  ): Promise<{ storageKey: string }> {
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
    const storageKey = buildEntityPhotoStorageKey(entityType, entityId, fileId);
    if (!isValidEntityPhotoStorageKey(storageKey)) {
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

  async storeBuildingPhoto(buildingId: string, buffer: Buffer): Promise<{ storageKey: string }> {
    return this.storePhoto("buildings", buildingId, buffer);
  }

  async storeSpacePhoto(spaceId: string, buffer: Buffer): Promise<{ storageKey: string }> {
    return this.storePhoto("spaces", spaceId, buffer);
  }

  async deletePhotoFile(storageKey: string): Promise<void> {
    if (!isValidEntityPhotoStorageKey(storageKey)) {
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

  async deleteEntityDirectory(entityType: UploadEntityType, entityId: string): Promise<void> {
    const entityDir = path.resolve(this.uploadsDir, entityType, entityId);
    const uploadsPrefix = this.uploadsDir.endsWith(path.sep)
      ? this.uploadsDir
      : `${this.uploadsDir}${path.sep}`;

    if (!entityDir.startsWith(uploadsPrefix)) {
      return;
    }

    await rm(entityDir, { recursive: true, force: true });
  }

  async deleteBuildingDirectory(buildingId: string): Promise<void> {
    return this.deleteEntityDirectory("buildings", buildingId);
  }

  async deleteSpaceDirectory(spaceId: string): Promise<void> {
    return this.deleteEntityDirectory("spaces", spaceId);
  }
}
