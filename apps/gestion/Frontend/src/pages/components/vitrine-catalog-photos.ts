import type { BuildingPhotoResponse } from "@coworkprysme/shared";

import { buildingPhotoUrl } from "../../lib/buildings-mappers.js";
import { spacePhotoUrl } from "../../lib/spaces-mappers.js";

function resolvePrimaryPhoto(photos: BuildingPhotoResponse[]): BuildingPhotoResponse | null {
  if (photos.length === 0) {
    return null;
  }
  return photos.find((photo) => photo.isPrimary) ?? photos[0] ?? null;
}

export function buildingPrimaryPhotoUrl(photos: BuildingPhotoResponse[]): string | null {
  const primary = resolvePrimaryPhoto(photos);
  return primary ? buildingPhotoUrl(primary.storageKey) : null;
}

export function spacePrimaryPhotoUrl(photos: BuildingPhotoResponse[]): string | null {
  const primary = resolvePrimaryPhoto(photos);
  return primary ? spacePhotoUrl(primary.storageKey) : null;
}
