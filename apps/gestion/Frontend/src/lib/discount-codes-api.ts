import type {
  CreateDiscountCodeRequest,
  DiscountCodeResponse,
  DiscountCodesListResponse,
  ServicePromoEligibility,
  UpdateDiscountCodeRequest,
} from "@coworkprysme/shared";

import { API_URL } from "./api.js";

async function discountCodesFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

export function fetchDiscountCodes(): Promise<DiscountCodesListResponse> {
  return discountCodesFetch<DiscountCodesListResponse>("/discount-codes");
}

export function fetchDiscountCode(id: string): Promise<DiscountCodeResponse> {
  return discountCodesFetch<DiscountCodeResponse>(`/discount-codes/${id}`);
}

export function fetchDiscountCodeServiceOptions(): Promise<{
  services: ServicePromoEligibility[];
}> {
  return discountCodesFetch<{ services: ServicePromoEligibility[] }>(
    "/discount-codes/service-options",
  );
}

export function createDiscountCode(
  payload: CreateDiscountCodeRequest,
): Promise<DiscountCodeResponse> {
  return discountCodesFetch<DiscountCodeResponse>("/discount-codes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateDiscountCode(
  id: string,
  payload: UpdateDiscountCodeRequest,
): Promise<DiscountCodeResponse> {
  return discountCodesFetch<DiscountCodeResponse>(`/discount-codes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
