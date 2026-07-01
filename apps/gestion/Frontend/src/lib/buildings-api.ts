import type {
  BuildingResponse,
  BuildingsListResponse,
  CreateBuildingRequest,
} from "@coworkprysme/shared";

import { API_URL } from "./api.js";

async function buildingsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}`);
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
