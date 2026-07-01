import type {
  BuildingPhotoResponse,
  BuildingResponse,
  CreateBuildingRequest,
} from "@coworkprysme/shared";
import { mediaPathFromStorageKey } from "@coworkprysme/shared";

import type { Building, BuildingFormValues, BuildingPhoto } from "../features/spaces/types.js";
import { createDefaultDaySchedules, createFloors } from "../features/spaces/utils/schedule.js";
import { API_URL } from "./api.js";

function mimeFromStorageKey(_storageKey: string): string {
  return "image/webp";
}

export function buildingPhotoUrl(storageKey: string): string {
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
        previewUrl: buildingPhotoUrl(photo.storageKey),
        fileName: photo.alt?.trim() || fileName,
        fileSize: 0,
        mimeType: mimeFromStorageKey(photo.storageKey),
      };
    });
}

/** @deprecated Use mapApiPhotosToFormPhotos */
export const apiPhotosToFormPhotos = mapApiPhotosToFormPhotos;

export function formValuesToCreateRequest(values: BuildingFormValues): CreateBuildingRequest {
  return {
    name: values.name,
    description: values.description.trim(),
    address: { ...values.address },
    floors: values.floors.map((floor) => ({ name: floor.name })),
    status: values.status,
    accessibilityHours: values.accessibilityHours.map((entry) => ({ ...entry })),
    receptionHours: values.receptionHours.map((entry) => ({ ...entry })),
    concierge: { ...values.concierge },
  };
}

export function buildingResponseToBuilding(response: BuildingResponse): Building {
  return {
    id: response.id,
    name: response.name,
    description: response.description,
    address: { ...response.address },
    lat: response.coordinates.lat,
    lng: response.coordinates.lng,
    floors: response.floors.map((floor) => ({ id: floor.id, name: floor.name })),
    status: response.status,
    accessibilityHours: response.accessibilityHours.map((entry) => ({ ...entry })),
    receptionHours: response.receptionHours.map((entry) => ({ ...entry })),
    concierge: { ...response.concierge },
    photos: mapApiPhotosToFormPhotos(response.photos),
  };
}

export function buildingResponseToFormValues(response: BuildingResponse): BuildingFormValues {
  return {
    name: response.name,
    description: response.description ?? "",
    address: { ...response.address },
    lat: response.coordinates.lat,
    lng: response.coordinates.lng,
    floors: response.floors.map((floor) => ({ id: floor.id, name: floor.name })),
    status: response.status,
    accessibilityHours: response.accessibilityHours.map((entry) => ({ ...entry })),
    receptionHours: response.receptionHours.map((entry) => ({ ...entry })),
    concierge: { ...response.concierge },
    photos: mapApiPhotosToFormPhotos(response.photos),
  };
}

export function createEmptyBuildingFormValues(): BuildingFormValues {
  return {
    name: "",
    description: "",
    address: {
      street: "",
      postalCode: "",
      city: "",
      country: "France",
    },
    lat: null,
    lng: null,
    floors: createFloors(1),
    status: "active",
    accessibilityHours: createDefaultDaySchedules(),
    receptionHours: createDefaultDaySchedules(),
    concierge: { link: "", accessCode: "" },
    photos: [],
  };
}
