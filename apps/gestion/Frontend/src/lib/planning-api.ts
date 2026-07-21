import type {
  PlanningCalendarResponse,
  PlanningCancelPreview,
  PlanningCancelRequest,
  PlanningCancelResult,
  PlanningContactTransferPreview,
  PlanningContactTransferRequest,
  PlanningContactTransferResult,
  PlanningCreateInvitationRequest,
  PlanningDateChangePreview,
  PlanningDateChangeRequest,
  PlanningDateChangeResult,
  PlanningInvitation,
  PlanningInvitationListResponse,
  PlanningInvitationMutationResult,
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

export class PlanningApiError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = "PlanningApiError";
    this.status = status;
    this.code = code;
  }
}

function extractErrorPayload(json: unknown): { code: string | null; message: string | null } {
  if (typeof json !== "object" || json === null) {
    return { code: null, message: null };
  }
  const root = json as Record<string, unknown>;
  if (typeof root.code === "string" && typeof root.message === "string") {
    return { code: root.code, message: root.message };
  }
  if (typeof root.message === "object" && root.message !== null) {
    const nested = root.message as Record<string, unknown>;
    return {
      code: typeof nested.code === "string" ? nested.code : null,
      message: typeof nested.message === "string" ? nested.message : null,
    };
  }
  if (typeof root.message === "string") {
    return { code: null, message: root.message };
  }
  if (Array.isArray(root.message) && typeof root.message[0] === "string") {
    return { code: null, message: root.message[0] };
  }
  return { code: null, message: null };
}

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
    let code: string | null = null;
    try {
      const body: unknown = await response.json();
      const payload = extractErrorPayload(body);
      if (payload.message) message = payload.message;
      code = payload.code;
    } catch {
      // keep default
    }
    throw new PlanningApiError(response.status, message, code);
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

export function fetchPlanningInvitations(
  reservationId: string,
): Promise<PlanningInvitationListResponse> {
  return planningFetch(`/planning/reservations/${encodeURIComponent(reservationId)}/invitations`);
}

export function createPlanningInvitation(
  reservationId: string,
  request: PlanningCreateInvitationRequest,
): Promise<PlanningInvitationMutationResult> {
  return planningFetch(`/planning/reservations/${encodeURIComponent(reservationId)}/invitations`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function resendPlanningInvitation(
  invitationId: string,
): Promise<PlanningInvitationMutationResult> {
  return planningFetch(`/planning/invitations/${encodeURIComponent(invitationId)}/resend`, {
    method: "POST",
    body: "{}",
  });
}

export function revokePlanningInvitation(invitationId: string): Promise<PlanningInvitation> {
  return planningFetch(`/planning/invitations/${encodeURIComponent(invitationId)}/revoke`, {
    method: "POST",
    body: "{}",
  });
}
