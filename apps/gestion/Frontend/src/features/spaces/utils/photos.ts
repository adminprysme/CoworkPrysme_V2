import type { BuildingPhoto } from "../types.js";

export function revokePhotoUrls(photos: BuildingPhoto[]): void {
  for (const photo of photos) {
    if (photo.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(photo.previewUrl);
    }
  }
}
