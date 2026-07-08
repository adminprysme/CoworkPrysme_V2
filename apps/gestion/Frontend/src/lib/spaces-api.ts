import type {
  CreateSpaceRequest,
  SpaceArchiveResponse,
  SpaceResponse,
  SpacesListResponse,
  UpdateEntityPhotosRequest,
} from "@coworkprysme/shared";

import { API_URL } from "./api.js";

async function spacesFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

export function fetchSpacesByBuilding(
  buildingId: string,
  options?: { includeArchived?: boolean; archivedOnly?: boolean },
): Promise<SpacesListResponse> {
  const params = new URLSearchParams();
  if (options?.archivedOnly) {
    params.set("archivedOnly", "true");
  } else if (options?.includeArchived) {
    params.set("includeArchived", "true");
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return spacesFetch<SpacesListResponse>(`/buildings/${buildingId}/spaces${query}`);
}

export function fetchArchivedSpacesByBuilding(buildingId: string): Promise<SpacesListResponse> {
  return fetchSpacesByBuilding(buildingId, { archivedOnly: true });
}

export function fetchSpace(id: string): Promise<SpaceResponse> {
  return spacesFetch<SpaceResponse>(`/spaces/${id}`);
}

export function createSpace(
  buildingId: string,
  payload: CreateSpaceRequest,
): Promise<SpaceResponse> {
  return spacesFetch<SpaceResponse>(`/buildings/${buildingId}/spaces`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateSpace(id: string, payload: CreateSpaceRequest): Promise<SpaceResponse> {
  return spacesFetch<SpaceResponse>(`/spaces/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function archiveSpace(id: string): Promise<SpaceArchiveResponse> {
  return spacesFetch<SpaceArchiveResponse>(`/spaces/${id}`, {
    method: "DELETE",
  });
}

export function restoreSpace(
  id: string,
  status: "active" | "inactive" = "inactive",
): Promise<SpaceResponse> {
  return spacesFetch<SpaceResponse>(`/spaces/${id}/restore`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export function purgeSpacePermanently(id: string): Promise<{ ok: true }> {
  return spacesFetch<{ ok: true }>(`/spaces/${id}/permanent`, {
    method: "DELETE",
  });
}

export function uploadSpacePhoto(spaceId: string, file: File): Promise<SpaceResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return spacesFetch<SpaceResponse>(`/spaces/${spaceId}/photos`, {
    method: "POST",
    body: formData,
  });
}

export function deleteSpacePhoto(spaceId: string, storageKey: string): Promise<SpaceResponse> {
  const filename = storageKey.split("/").pop();
  if (!filename) {
    throw new Error("Invalid storage key");
  }
  return spacesFetch<SpaceResponse>(`/spaces/${spaceId}/photos/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });
}

export function updateSpacePhotos(
  spaceId: string,
  payload: UpdateEntityPhotosRequest,
): Promise<SpaceResponse> {
  return spacesFetch<SpaceResponse>(`/spaces/${spaceId}/photos`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
