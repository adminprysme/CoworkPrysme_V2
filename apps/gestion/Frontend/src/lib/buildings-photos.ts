import type { UpdateBuildingPhotosRequest, BuildingResponse } from "@coworkprysme/shared";

import type { BuildingPhoto } from "../features/spaces/types.js";
import { deleteBuildingPhoto, updateBuildingPhotos, uploadBuildingPhoto } from "./buildings-api.js";
import { buildingPhotoUrl, mapApiPhotosToFormPhotos } from "./buildings-mappers.js";

function photosToPatchPayload(photos: BuildingPhoto[]): UpdateBuildingPhotosRequest {
  return {
    photos: photos.map((photo, index) => ({
      storageKey: photo.storageKey!,
      order: index,
      isPrimary: index === 0,
    })),
  };
}

export async function persistBuildingPhotos(
  buildingId: string,
  photos: BuildingPhoto[],
): Promise<BuildingPhoto[]> {
  const uploadedPhotos: BuildingPhoto[] = [];

  for (const photo of photos) {
    if (photo.storageKey) {
      uploadedPhotos.push(photo);
      continue;
    }

    if (!photo.file) {
      continue;
    }

    const response = await uploadBuildingPhoto(buildingId, photo.file);
    const uploaded = response.photos.at(-1);
    if (!uploaded) {
      throw new Error("Upload failed");
    }

    if (photo.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(photo.previewUrl);
    }

    uploadedPhotos.push({
      id: uploaded.storageKey,
      storageKey: uploaded.storageKey,
      previewUrl: buildingPhotoUrl(uploaded.storageKey),
      fileName: photo.fileName,
      fileSize: photo.fileSize,
      mimeType: "image/webp",
    });
  }

  const patchResponse = await updateBuildingPhotos(
    buildingId,
    photosToPatchPayload(uploadedPhotos),
  );
  return mapApiPhotosToFormPhotos(patchResponse.photos);
}

export async function removePersistedBuildingPhoto(
  buildingId: string,
  storageKey: string,
): Promise<BuildingResponse> {
  return deleteBuildingPhoto(buildingId, storageKey);
}
