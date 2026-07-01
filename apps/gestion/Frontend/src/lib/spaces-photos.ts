import type { UpdateEntityPhotosRequest, SpaceResponse } from "@coworkprysme/shared";

import type { BuildingPhoto } from "../features/spaces/types.js";
import { deleteSpacePhoto, updateSpacePhotos, uploadSpacePhoto } from "./spaces-api.js";
import { mapApiPhotosToFormPhotos, spacePhotoUrl } from "./spaces-mappers.js";

function photosToPatchPayload(photos: BuildingPhoto[]): UpdateEntityPhotosRequest {
  return {
    photos: photos.map((photo, index) => ({
      storageKey: photo.storageKey!,
      order: index,
      isPrimary: index === 0,
    })),
  };
}

export async function persistSpacePhotos(
  spaceId: string,
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

    const response = await uploadSpacePhoto(spaceId, photo.file);
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
      previewUrl: spacePhotoUrl(uploaded.storageKey),
      fileName: photo.fileName,
      fileSize: photo.fileSize,
      mimeType: "image/webp",
    });
  }

  const patchResponse = await updateSpacePhotos(spaceId, photosToPatchPayload(uploadedPhotos));
  return mapApiPhotosToFormPhotos(patchResponse.photos);
}

export async function removePersistedSpacePhoto(
  spaceId: string,
  storageKey: string,
): Promise<SpaceResponse> {
  return deleteSpacePhoto(spaceId, storageKey);
}
