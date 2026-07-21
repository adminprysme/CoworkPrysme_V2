import type {
  PlanningCalendarResponse,
  PlanningCancelPreview,
  PlanningCancelRequest,
  PlanningCancelResult,
  PlanningContactTransferPreview,
  PlanningContactTransferRequest,
  PlanningContactTransferResult,
  PlanningDateChangePreview,
  PlanningDateChangeRequest,
  PlanningDateChangeResult,
  PlanningManageSpaceOption,
  PlanningManualRefundRequest,
  PlanningManualRefundResult,
  PlanningPartySizePreview,
  PlanningPartySizeRequest,
  PlanningPartySizeResult,
  PlanningRestorePreview,
  PlanningRestoreRequest,
  PlanningRestoreResult,
  PlanningOccupancyResponse,
  PlanningReservationDetail,
  PlanningSearchResponse,
  PlanningSpaceChangePreview,
  PlanningSpaceChangeRequest,
  PlanningSpaceChangeResult,
  PlanningSpaceHistoryResponse,
} from "@coworkprysme/shared";

import { API_URL } from "./api.js";

async function planningFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

export function fetchPlanningCalendar(params: {
  from: string;
  to: string;
  buildingId?: string;
}): Promise<PlanningCalendarResponse> {
  const search = new URLSearchParams({
    from: params.from,
    to: params.to,
  });
  if (params.buildingId) {
    search.set("buildingId", params.buildingId);
  }
  return planningFetch(`/planning/calendar?${search.toString()}`);
}

export function fetchPlanningOccupancy(): Promise<PlanningOccupancyResponse> {
  return planningFetch("/planning/occupancy");
}

export function fetchPlanningSearch(q: string): Promise<PlanningSearchResponse> {
  const search = new URLSearchParams({ q });
  return planningFetch(`/planning/search?${search.toString()}`);
}

export function fetchPlanningReservation(id: string): Promise<PlanningReservationDetail> {
  return planningFetch(`/planning/reservations/${encodeURIComponent(id)}`);
}

export function fetchSpaceHistory(params: {
  spaceId: string;
  from: string;
  to: string;
  types?: string[];
}): Promise<PlanningSpaceHistoryResponse> {
  const search = new URLSearchParams({
    from: params.from,
    to: params.to,
  });
  if (params.types?.length) {
    search.set("types", params.types.join(","));
  }
  return planningFetch(
    `/planning/spaces/${encodeURIComponent(params.spaceId)}/history?${search.toString()}`,
  );
}

export function fetchManageCandidateSpaces(
  reservationId: string,
): Promise<PlanningManageSpaceOption[]> {
  return planningFetch(`/planning/reservations/${encodeURIComponent(reservationId)}/manage/spaces`);
}

export function fetchSpaceChangePreview(
  reservationId: string,
  nextSpaceId: string,
): Promise<PlanningSpaceChangePreview> {
  const search = new URLSearchParams({ nextSpaceId });
  return planningFetch(
    `/planning/reservations/${encodeURIComponent(reservationId)}/manage/space-change/preview?${search.toString()}`,
  );
}

export function confirmSpaceChange(
  reservationId: string,
  request: PlanningSpaceChangeRequest,
): Promise<PlanningSpaceChangeResult> {
  return planningFetch(
    `/planning/reservations/${encodeURIComponent(reservationId)}/manage/space-change`,
    { method: "POST", body: JSON.stringify(request) },
  );
}

export function fetchCancelPreview(reservationId: string): Promise<PlanningCancelPreview> {
  return planningFetch(
    `/planning/reservations/${encodeURIComponent(reservationId)}/manage/cancel/preview`,
  );
}

export function confirmCancelReservation(
  reservationId: string,
  request: PlanningCancelRequest,
): Promise<PlanningCancelResult> {
  return planningFetch(
    `/planning/reservations/${encodeURIComponent(reservationId)}/manage/cancel`,
    { method: "POST", body: JSON.stringify(request) },
  );
}

export function confirmManualRefund(
  reservationId: string,
  request: PlanningManualRefundRequest,
): Promise<PlanningManualRefundResult> {
  return planningFetch(
    `/planning/reservations/${encodeURIComponent(reservationId)}/manage/cancel/manual-refund`,
    { method: "POST", body: JSON.stringify(request) },
  );
}

export function fetchRestorePreview(reservationId: string): Promise<PlanningRestorePreview> {
  return planningFetch(
    `/planning/reservations/${encodeURIComponent(reservationId)}/manage/restore/preview`,
  );
}

export function confirmRestoreReservation(
  reservationId: string,
  request: PlanningRestoreRequest,
): Promise<PlanningRestoreResult> {
  return planningFetch(
    `/planning/reservations/${encodeURIComponent(reservationId)}/manage/restore`,
    { method: "POST", body: JSON.stringify(request) },
  );
}

export function fetchDateChangePreview(
  reservationId: string,
  startAt: string,
  endAt: string,
): Promise<PlanningDateChangePreview> {
  const search = new URLSearchParams({ startAt, endAt });
  return planningFetch(
    `/planning/reservations/${encodeURIComponent(reservationId)}/manage/date-change/preview?${search.toString()}`,
  );
}

export function confirmDateChange(
  reservationId: string,
  request: PlanningDateChangeRequest,
): Promise<PlanningDateChangeResult> {
  return planningFetch(
    `/planning/reservations/${encodeURIComponent(reservationId)}/manage/date-change`,
    { method: "POST", body: JSON.stringify(request) },
  );
}

export function fetchPartySizePreview(
  reservationId: string,
  newPartySize: number,
): Promise<PlanningPartySizePreview> {
  const search = new URLSearchParams({ newPartySize: String(newPartySize) });
  return planningFetch(
    `/planning/reservations/${encodeURIComponent(reservationId)}/manage/party-size/preview?${search.toString()}`,
  );
}

export function confirmPartySize(
  reservationId: string,
  request: PlanningPartySizeRequest,
): Promise<PlanningPartySizeResult> {
  return planningFetch(
    `/planning/reservations/${encodeURIComponent(reservationId)}/manage/party-size`,
    { method: "POST", body: JSON.stringify(request) },
  );
}

export function fetchContactTransferPreview(
  reservationId: string,
  nextClientAccountId: string,
): Promise<PlanningContactTransferPreview> {
  const search = new URLSearchParams({ nextClientAccountId });
  return planningFetch(
    `/planning/reservations/${encodeURIComponent(reservationId)}/manage/contact-transfer/preview?${search.toString()}`,
  );
}

export function confirmContactTransfer(
  reservationId: string,
  request: PlanningContactTransferRequest,
): Promise<PlanningContactTransferResult> {
  return planningFetch(
    `/planning/reservations/${encodeURIComponent(reservationId)}/manage/contact-transfer`,
    { method: "POST", body: JSON.stringify(request) },
  );
}
