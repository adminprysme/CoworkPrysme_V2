import type { BuildingFormValues } from "../types.js";

/** Stable snapshot of form values for dirty-checking (ignores ephemeral photo fields). */
export function getBuildingFormDirtySnapshot(values: BuildingFormValues): string {
  return JSON.stringify({
    name: values.name,
    description: values.description,
    phone: values.phone,
    email: values.email,
    address: values.address,
    lat: values.lat,
    lng: values.lng,
    floors: values.floors.map((floor) => ({ name: floor.name })),
    status: values.status,
    accessibilityHours: values.accessibilityHours,
    receptionHours: values.receptionHours,
    concierge: values.concierge,
    photos: values.photos.map((photo) => ({
      storageKey: photo.storageKey ?? null,
      fileName: photo.fileName,
      pendingUpload: Boolean(photo.file),
    })),
  });
}

export function isBuildingFormDirty(
  current: BuildingFormValues,
  baselineSnapshot: string | null,
): boolean {
  if (!baselineSnapshot) {
    return false;
  }
  return getBuildingFormDirtySnapshot(current) !== baselineSnapshot;
}
