import type {
  BuildingPhotoResponse,
  CreateSpaceRequest,
  SpaceResponse,
} from "@coworkprysme/shared";
import { DURATION_CLASS_LABELS, mediaPathFromStorageKey } from "@coworkprysme/shared";

import type { BuildingPhoto } from "../features/spaces/types.js";
import type { Space, SpaceFormValues } from "../features/spaces/space-types.js";
import {
  createDefaultTariffLines,
  tariffLinesToApiInput,
  tariffResponseToFormLines,
} from "../features/spaces/utils/space-tariffs.js";
import { API_URL } from "./api.js";

export function spacePhotoUrl(storageKey: string): string {
  const path = mediaPathFromStorageKey(storageKey);
  return API_URL ? `${API_URL}${path}` : path;
}

export function mapApiPhotosToFormPhotos(photos: BuildingPhotoResponse[]): BuildingPhoto[] {
  return [...photos]
    .sort((left, right) => {
      if (left.isPrimary !== right.isPrimary) {
        return left.isPrimary ? -1 : 1;
      }
      return left.order - right.order;
    })
    .map((photo) => {
      const fileName = photo.storageKey.split("/").pop() ?? photo.storageKey;
      return {
        id: photo.storageKey,
        storageKey: photo.storageKey,
        previewUrl: spacePhotoUrl(photo.storageKey),
        fileName: photo.alt?.trim() || fileName,
        fileSize: 0,
        mimeType: "image/webp",
      };
    });
}

export function formValuesToCreateRequest(values: SpaceFormValues): CreateSpaceRequest {
  return {
    type: values.type,
    name: values.name,
    description: values.description.trim(),
    floor: values.floor,
    capacity: values.capacity,
    equipments: values.equipments.map((equipment) => ({ ...equipment })),
    openingHours: values.openingHours.map((entry) => ({ ...entry })),
    accessCode: values.accessCode.trim(),
    status: values.status,
    tariffs: tariffLinesToApiInput(values.tariffs),
  };
}

export function spaceResponseToSpace(response: SpaceResponse): Space {
  return {
    id: response.id,
    buildingId: response.buildingId,
    type: response.type,
    name: response.name,
    description: response.description ?? "",
    floor: response.floor,
    capacity: response.capacity,
    equipments: response.equipments.map((equipment) => ({ ...equipment })),
    openingHours: response.openingHours.map((entry) => ({ ...entry })),
    accessCode: response.accessCode,
    status: response.status,
    archivedAt: response.archivedAt,
    archivedBy: response.archivedBy,
    photos: mapApiPhotosToFormPhotos(response.photos),
    tariffs: response.tariffs.map((tariff) => ({
      durationClass: tariff.durationClass,
      label: DURATION_CLASS_LABELS[tariff.durationClass],
      priceHT: tariff.priceHT,
      vatRate: tariff.vatRate,
    })),
  };
}

export function spaceResponseToFormValues(
  response: SpaceResponse,
  buildingHours?: SpaceFormValues["openingHours"],
): SpaceFormValues {
  const hoursMatchBuilding =
    buildingHours !== undefined &&
    buildingHours.length === response.openingHours.length &&
    buildingHours.every((entry, index) => {
      const spaceEntry = response.openingHours[index];
      return (
        spaceEntry &&
        entry.day === spaceEntry.day &&
        entry.is24h === spaceEntry.is24h &&
        entry.openTime === spaceEntry.openTime &&
        entry.closeTime === spaceEntry.closeTime
      );
    });

  return {
    type: response.type,
    name: response.name,
    description: response.description ?? "",
    floor: response.floor,
    capacity: response.capacity,
    equipments: response.equipments.map((equipment) => ({ ...equipment })),
    openingHours: response.openingHours.map((entry) => ({ ...entry })),
    useBuildingHours: hoursMatchBuilding,
    accessCode: response.accessCode ?? "",
    status: response.status === "archived" ? "inactive" : response.status,
    photos: mapApiPhotosToFormPhotos(response.photos),
    tariffs:
      response.tariffs.length > 0
        ? tariffResponseToFormLines(response.tariffs)
        : createDefaultTariffLines(),
  };
}
