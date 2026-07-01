import { z } from "zod";

export const UPLOAD_ENTITY_TYPES = ["buildings", "spaces"] as const;

export type UploadEntityType = (typeof UPLOAD_ENTITY_TYPES)[number];

export const ENTITY_PHOTO_STORAGE_KEY_PATTERN =
  /^(buildings|spaces)\/[a-f0-9]{24}\/[0-9a-f-]{36}\.webp$/;

/** @deprecated Use ENTITY_PHOTO_STORAGE_KEY_PATTERN */
export const BUILDING_PHOTO_STORAGE_KEY_PATTERN = /^buildings\/[a-f0-9]{24}\/[0-9a-f-]{36}\.webp$/;

export const DEFAULT_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const DEFAULT_UPLOAD_MAX_PHOTOS_PER_BUILDING = 15;
export const DEFAULT_UPLOAD_MAX_PHOTOS_PER_SPACE = 15;
export const DEFAULT_UPLOAD_MAX_DIMENSION_PX = 2048;

export const UploadLimitsSchema = z.object({
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(DEFAULT_UPLOAD_MAX_BYTES),
  UPLOAD_MAX_PHOTOS_PER_BUILDING: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_UPLOAD_MAX_PHOTOS_PER_BUILDING),
  UPLOAD_MAX_PHOTOS_PER_SPACE: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_UPLOAD_MAX_PHOTOS_PER_SPACE),
  UPLOAD_MAX_DIMENSION_PX: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_UPLOAD_MAX_DIMENSION_PX),
});

export const UpdateEntityPhotosRequestSchema = z.object({
  photos: z.array(
    z.object({
      storageKey: z.string(),
      order: z.number().int().min(0),
      isPrimary: z.boolean(),
      alt: z.string().optional(),
    }),
  ),
});

/** @deprecated Use UpdateEntityPhotosRequestSchema */
export const UpdateBuildingPhotosRequestSchema = UpdateEntityPhotosRequestSchema;

export type UpdateEntityPhotosRequest = z.infer<typeof UpdateEntityPhotosRequestSchema>;
/** @deprecated Use UpdateEntityPhotosRequest */
export type UpdateBuildingPhotosRequest = UpdateEntityPhotosRequest;

export function isValidEntityPhotoStorageKey(storageKey: string): boolean {
  return ENTITY_PHOTO_STORAGE_KEY_PATTERN.test(storageKey);
}

export function isValidBuildingPhotoStorageKey(storageKey: string): boolean {
  return isValidEntityPhotoStorageKey(storageKey) && storageKey.startsWith("buildings/");
}

export function isValidSpacePhotoStorageKey(storageKey: string): boolean {
  return isValidEntityPhotoStorageKey(storageKey) && storageKey.startsWith("spaces/");
}

export function buildEntityPhotoStorageKey(
  entityType: UploadEntityType,
  entityId: string,
  fileId: string,
): string {
  return `${entityType}/${entityId}/${fileId}.webp`;
}

export function buildBuildingPhotoStorageKey(buildingId: string, fileId: string): string {
  return buildEntityPhotoStorageKey("buildings", buildingId, fileId);
}

export function buildSpacePhotoStorageKey(spaceId: string, fileId: string): string {
  return buildEntityPhotoStorageKey("spaces", spaceId, fileId);
}

/** URL path served by gestion-api / vitrine-api (no origin). */
export function mediaPathFromStorageKey(storageKey: string): string {
  return `/media/${storageKey}`;
}
