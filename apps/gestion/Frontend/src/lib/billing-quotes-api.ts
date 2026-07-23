import type {
  StaffBillingClientSearchResponse,
  StaffCreateQuoteRequest,
  StaffDeleteQuoteResponse,
  StaffQuote,
  StaffQuoteAvailabilityCheckRequest,
  StaffQuoteAvailabilityCheckResponse,
  StaffQuoteListQuery,
  StaffQuoteListResponse,
  StaffQuoteLocksAcquireRequest,
  StaffQuoteLocksAcquireResponse,
  StaffQuoteLocksRefreshResponse,
  StaffQuoteLocksReleaseResponse,
  StaffQuoteLocksSessionRequest,
  StaffSendQuoteResponse,
  StaffUpdateQuoteRequest,
} from "@coworkprysme/shared";

import { API_URL } from "./api.js";

async function quotesFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
      const body = (await response.json()) as { message?: string | string[]; code?: string };
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

export function listQuotes(
  query: Partial<StaffQuoteListQuery> = {},
): Promise<StaffQuoteListResponse> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.cardexId) params.set("cardexId", query.cardexId);
  if (query.q) params.set("q", query.q);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return quotesFetch<StaffQuoteListResponse>(`/billing/quotes${qs ? `?${qs}` : ""}`);
}

export function getQuote(id: string): Promise<StaffQuote> {
  return quotesFetch<StaffQuote>(`/billing/quotes/${encodeURIComponent(id)}`);
}

export function createQuote(input: StaffCreateQuoteRequest): Promise<StaffQuote> {
  return quotesFetch<StaffQuote>("/billing/quotes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateQuote(id: string, input: StaffUpdateQuoteRequest): Promise<StaffQuote> {
  return quotesFetch<StaffQuote>(`/billing/quotes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteQuoteDraft(id: string): Promise<StaffDeleteQuoteResponse> {
  return quotesFetch<StaffDeleteQuoteResponse>(`/billing/quotes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function sendQuote(id: string): Promise<StaffSendQuoteResponse> {
  return quotesFetch<StaffSendQuoteResponse>(`/billing/quotes/${encodeURIComponent(id)}/send`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function searchBillingClients(q: string): Promise<StaffBillingClientSearchResponse> {
  const params = new URLSearchParams({ q });
  return quotesFetch<StaffBillingClientSearchResponse>(`/billing/clients/search?${params}`);
}

export function refuseQuote(id: string): Promise<StaffQuote> {
  return quotesFetch<StaffQuote>(`/billing/quotes/${encodeURIComponent(id)}/refuse`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function expireQuote(id: string): Promise<StaffQuote> {
  return quotesFetch<StaffQuote>(`/billing/quotes/${encodeURIComponent(id)}/expire`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/** Staff accept lives in #8 (AcceptQuoteService). Endpoint not shipped yet. */
export const STAFF_QUOTE_ACCEPT_AVAILABLE = false;

export function checkQuoteAvailability(
  input: StaffQuoteAvailabilityCheckRequest,
): Promise<StaffQuoteAvailabilityCheckResponse> {
  return quotesFetch<StaffQuoteAvailabilityCheckResponse>("/billing/quotes/availability/check", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function acquireQuoteLocks(
  input: StaffQuoteLocksAcquireRequest,
): Promise<StaffQuoteLocksAcquireResponse> {
  return quotesFetch<StaffQuoteLocksAcquireResponse>("/billing/quotes/locks/acquire", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function refreshQuoteLocks(
  input: StaffQuoteLocksSessionRequest,
): Promise<StaffQuoteLocksRefreshResponse> {
  return quotesFetch<StaffQuoteLocksRefreshResponse>("/billing/quotes/locks/refresh", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function releaseQuoteLocks(
  input: StaffQuoteLocksSessionRequest,
): Promise<StaffQuoteLocksReleaseResponse> {
  return quotesFetch<StaffQuoteLocksReleaseResponse>("/billing/quotes/locks/release", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
