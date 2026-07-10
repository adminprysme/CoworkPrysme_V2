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
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
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

  return response.json() as Promise<T>;
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
