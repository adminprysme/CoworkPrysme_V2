import path from "node:path";
import { z } from "zod";

export const BUILDING_PHOTO_STORAGE_KEY_PATTERN = /^buildings\/[a-f0-9]{24}\/[0-9a-f-]{36}\.webp$/;

export const DEFAULT_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const DEFAULT_UPLOAD_MAX_PHOTOS_PER_BUILDING = 15;
export const DEFAULT_UPLOAD_MAX_DIMENSION_PX = 2048;

export const UploadLimitsSchema = z.object({
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(DEFAULT_UPLOAD_MAX_BYTES),
  UPLOAD_MAX_PHOTOS_PER_BUILDING: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_UPLOAD_MAX_PHOTOS_PER_BUILDING),
  UPLOAD_MAX_DIMENSION_PX: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_UPLOAD_MAX_DIMENSION_PX),
});

export const UpdateBuildingPhotosRequestSchema = z.object({
  photos: z.array(
    z.object({
      storageKey: z.string(),
      order: z.number().int().min(0),
      isPrimary: z.boolean(),
      alt: z.string().optional(),
    }),
  ),
});

export type UpdateBuildingPhotosRequest = z.infer<typeof UpdateBuildingPhotosRequestSchema>;

export function isValidBuildingPhotoStorageKey(storageKey: string): boolean {
  return BUILDING_PHOTO_STORAGE_KEY_PATTERN.test(storageKey);
}

export function buildBuildingPhotoStorageKey(buildingId: string, fileId: string): string {
  return `buildings/${buildingId}/${fileId}.webp`;
}

/** URL path served by gestion-api / vitrine-api (no origin). */
export function mediaPathFromStorageKey(storageKey: string): string {
  return `/media/${storageKey}`;
}

export function resolveStorageKeyAbsolutePath(
  uploadsDir: string,
  storageKey: string,
): string | null {
  if (!isValidBuildingPhotoStorageKey(storageKey)) {
    return null;
  }

  const absoluteUploads = path.resolve(uploadsDir);
  const absoluteTarget = path.resolve(absoluteUploads, storageKey);
  const uploadsPrefix = absoluteUploads.endsWith(path.sep)
    ? absoluteUploads
    : `${absoluteUploads}${path.sep}`;

  if (!absoluteTarget.startsWith(uploadsPrefix)) {
    return null;
  }

  return absoluteTarget;
}

export function resolveUploadsDir(env: NodeJS.ProcessEnv, cwd: string): string {
  if (env.UPLOADS_DIR?.trim()) {
    return path.resolve(env.UPLOADS_DIR.trim());
  }

  if (env.NODE_ENV === "production") {
    throw new Error("Invalid or missing environment configuration");
  }

  return path.resolve(cwd, "../../../uploads");
}
