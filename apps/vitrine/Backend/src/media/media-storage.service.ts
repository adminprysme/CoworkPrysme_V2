import { Injectable, NotFoundException, type OnModuleInit } from "@nestjs/common";
import {
  parseVitrineApiEnv,
  resolveStorageKeyAbsolutePath,
  resolveUploadsDir,
} from "@coworkprysme/shared/server";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";

@Injectable()
export class MediaStorageService implements OnModuleInit {
  private uploadsDir = "";

  async onModuleInit(): Promise<void> {
    const env = parseVitrineApiEnv();
    this.uploadsDir = resolveUploadsDir(process.env, process.cwd());
    if (env.UPLOADS_DIR?.trim()) {
      this.uploadsDir = path.resolve(env.UPLOADS_DIR.trim());
    }
    await mkdir(this.uploadsDir, { recursive: true });
  }

  async assertReadableFile(storageKey: string): Promise<string> {
    const absolutePath = resolveStorageKeyAbsolutePath(this.uploadsDir, storageKey);
    if (!absolutePath) {
      throw new NotFoundException();
    }

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
}
