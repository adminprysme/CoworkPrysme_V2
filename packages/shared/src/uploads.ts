import { z } from "zod";

export const UPLOAD_ENTITY_TYPES = ["buildings", "spaces", "services"] as const;

export type UploadEntityType = (typeof UPLOAD_ENTITY_TYPES)[number];

export const ENTITY_PHOTO_STORAGE_KEY_PATTERN =
  /^(buildings|spaces|services)\/[a-f0-9]{24}\/[0-9a-f-]{36}\.webp$/;

/** @deprecated Use ENTITY_PHOTO_STORAGE_KEY_PATTERN */
export const BUILDING_PHOTO_STORAGE_KEY_PATTERN = /^buildings\/[a-f0-9]{24}\/[0-9a-f-]{36}\.webp$/;

export const DEFAULT_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
/** Product limit for a single service photo upload (15 Mo). */
export const DEFAULT_UPLOAD_MAX_BYTES_SERVICE = 15 * 1024 * 1024;
/** Product limit for a single cardex document upload (PDF / identity images, 15 Mo). */
export const DEFAULT_UPLOAD_MAX_BYTES_DOCUMENT = 15 * 1024 * 1024;
export const DEFAULT_UPLOAD_MAX_PHOTOS_PER_BUILDING = 15;
export const DEFAULT_UPLOAD_MAX_PHOTOS_PER_SPACE = 15;
export const DEFAULT_UPLOAD_MAX_DIMENSION_PX = 2048;

export const UploadLimitsSchema = z.object({
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(DEFAULT_UPLOAD_MAX_BYTES),
  UPLOAD_MAX_BYTES_SERVICE: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_UPLOAD_MAX_BYTES_SERVICE),
  UPLOAD_MAX_BYTES_DOCUMENT: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_UPLOAD_MAX_BYTES_DOCUMENT),
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

export const ServicePhotoResponseSchema = z.object({
  storageKey: z.string(),
  url: z.string(),
  alt: z.string().optional(),
});

export type ServicePhotoResponse = z.infer<typeof ServicePhotoResponseSchema>;

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

export function isValidServicePhotoStorageKey(storageKey: string): boolean {
  return isValidEntityPhotoStorageKey(storageKey) && storageKey.startsWith("services/");
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

export function buildServicePhotoStorageKey(serviceId: string, fileId: string): string {
  return buildEntityPhotoStorageKey("services", serviceId, fileId);
}

/** URL path served by gestion-api / vitrine-api (no origin). */
export function mediaPathFromStorageKey(storageKey: string): string {
  return `/media/${storageKey}`;
}

/**
 * Phase 2 vitrine booking — service.photo will be shown when the client picks this
 * service in the tunnel (catalog attribute, not copied into reservation snapshot).
 */
