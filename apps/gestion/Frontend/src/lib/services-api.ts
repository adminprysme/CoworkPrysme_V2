import type {
  CreateServiceRequest,
  ServiceResponse,
  ServicesListResponse,
  UpdateServiceRequest,
} from "@coworkprysme/shared";

import { API_URL } from "./api.js";

async function servicesFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
      // keep default
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function servicePhotoUrl(urlPath: string): string {
  return API_URL ? `${API_URL}${urlPath}` : urlPath;
}

export function fetchServices(
  status: "all" | "active" | "inactive" = "all",
): Promise<ServicesListResponse> {
  const query = status === "all" ? "" : `?status=${status}`;
  return servicesFetch<ServicesListResponse>(`/services${query}`);
}

export function fetchService(id: string): Promise<ServiceResponse> {
  return servicesFetch<ServiceResponse>(`/services/${id}`);
}

export function createService(payload: CreateServiceRequest): Promise<ServiceResponse> {
  return servicesFetch<ServiceResponse>("/services", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateService(id: string, payload: UpdateServiceRequest): Promise<ServiceResponse> {
  return servicesFetch<ServiceResponse>(`/services/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteService(id: string): Promise<{ ok: true }> {
  return servicesFetch<{ ok: true }>(`/services/${id}`, {
    method: "DELETE",
  });
}

export function uploadServicePhoto(serviceId: string, file: File): Promise<ServiceResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return servicesFetch<ServiceResponse>(`/services/${serviceId}/photos`, {
    method: "POST",
    body: formData,
  });
}

export function deleteServicePhoto(serviceId: string): Promise<ServiceResponse> {
  return servicesFetch<ServiceResponse>(`/services/${serviceId}/photos`, {
    method: "DELETE",
  });
}
