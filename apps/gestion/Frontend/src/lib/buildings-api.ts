import type {
  BuildingResponse,
  BuildingsListResponse,
  CreateBuildingRequest,
  UpdateBuildingPhotosRequest,
} from "@coworkprysme/shared";

import { API_URL } from "./api.js";

async function buildingsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    },
  });

  if (!response.ok) {
    let message = `API ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (typeof body.message === "string") {
        message = body.message;
      } else if (Array.isArray(body.message) && typeof body.message[0] === "string") {
        message = body.message[0];
      }
    } catch {
      // keep default message
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function fetchBuildings(): Promise<BuildingsListResponse> {
  return buildingsFetch<BuildingsListResponse>("/buildings");
}

export function fetchBuilding(id: string): Promise<BuildingResponse> {
  return buildingsFetch<BuildingResponse>(`/buildings/${id}`);
}

export function createBuilding(payload: CreateBuildingRequest): Promise<BuildingResponse> {
  return buildingsFetch<BuildingResponse>("/buildings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateBuilding(
  id: string,
  payload: CreateBuildingRequest,
): Promise<BuildingResponse> {
  return buildingsFetch<BuildingResponse>(`/buildings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteBuilding(id: string): Promise<{ ok: true }> {
  return buildingsFetch<{ ok: true }>(`/buildings/${id}`, {
    method: "DELETE",
  });
}

export function uploadBuildingPhoto(buildingId: string, file: File): Promise<BuildingResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return buildingsFetch<BuildingResponse>(`/buildings/${buildingId}/photos`, {
    method: "POST",
    body: formData,
  });
}

export function deleteBuildingPhoto(
  buildingId: string,
  storageKey: string,
): Promise<BuildingResponse> {
  const filename = storageKey.split("/").pop();
  if (!filename) {
    throw new Error("Invalid storage key");
  }
  return buildingsFetch<BuildingResponse>(
    `/buildings/${buildingId}/photos/${encodeURIComponent(filename)}`,
    {
      method: "DELETE",
    },
  );
}

export function updateBuildingPhotos(
  buildingId: string,
  payload: UpdateBuildingPhotosRequest,
): Promise<BuildingResponse> {
  return buildingsFetch<BuildingResponse>(`/buildings/${buildingId}/photos`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
