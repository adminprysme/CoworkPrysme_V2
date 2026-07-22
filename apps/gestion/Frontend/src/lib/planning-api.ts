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
  StaffCardexDocument,
  StaffCardexDocumentsListResponse,
  StaffCardexInvoice,
  StaffCardexInvoicesListResponse,
  StaffClientAccount,
  StaffDeactivateClientAccountRequest,
  StaffTransferCardexOwnershipRequest,
  StaffTransferCardexOwnershipResult,
  StaffUploadCardexDocumentFields,
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

async function throwPlanningApiError(response: Response): Promise<never> {
  let message = `API ${response.status}`;
  let code: string | null = null;
  try {
    const body: unknown = await response.json();
    const payload = extractErrorPayload(body);
    if (payload.message) message = payload.message;
    code = payload.code;
  } catch {
    if (response.status === 413) {
      message = "Fichier trop volumineux (maximum 15 Mo).";
      code = "FILE_TOO_LARGE";
    }
  }
  throw new PlanningApiError(response.status, message, code);
}

async function planningFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    await throwPlanningApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function planningFetchBlob(
  path: string,
): Promise<{ blob: Blob; contentDisposition: string | null }> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { Accept: "*/*" },
  });

  if (!response.ok) {
    await throwPlanningApiError(response);
  }

  return {
    blob: await response.blob(),
    contentDisposition: response.headers.get("content-disposition"),
  };
}

function filenameFromContentDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      // fall through
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header) ?? /filename=([^;]+)/i.exec(header);
  return plain?.[1]?.trim() || fallback;
}

export async function downloadBlobAsFile(path: string, fallbackFilename: string): Promise<void> {
  const { blob, contentDisposition } = await planningFetchBlob(path);
  const filename = filenameFromContentDisposition(contentDisposition, fallbackFilename);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
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

export function deactivateClientAccount(
  clientAccountId: string,
  request: StaffDeactivateClientAccountRequest = {},
): Promise<StaffClientAccount> {
  return planningFetch(
    `/planning/client-accounts/${encodeURIComponent(clientAccountId)}/deactivate`,
    {
      method: "POST",
      body: JSON.stringify(request),
    },
  );
}

export function reactivateClientAccount(clientAccountId: string): Promise<StaffClientAccount> {
  return planningFetch(
    `/planning/client-accounts/${encodeURIComponent(clientAccountId)}/reactivate`,
    {
      method: "POST",
      body: "{}",
    },
  );
}

export function transferCardexOwnership(
  cardexId: string,
  request: StaffTransferCardexOwnershipRequest,
): Promise<StaffTransferCardexOwnershipResult> {
  return planningFetch(`/planning/cardexes/${encodeURIComponent(cardexId)}/transfer-ownership`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function fetchCardexDocuments(cardexId: string): Promise<StaffCardexDocumentsListResponse> {
  return planningFetch(`/planning/cardexes/${encodeURIComponent(cardexId)}/documents`);
}

export function uploadCardexDocument(
  cardexId: string,
  file: File,
  fields: StaffUploadCardexDocumentFields,
): Promise<StaffCardexDocument> {
  const form = new FormData();
  form.append("file", file);
  form.append("category", fields.category);
  if (fields.label) {
    form.append("label", fields.label);
  }
  return planningFetch(`/planning/cardexes/${encodeURIComponent(cardexId)}/documents`, {
    method: "POST",
    body: form,
  });
}

export function deleteCardexDocument(cardexId: string, documentId: string): Promise<{ ok: true }> {
  return planningFetch(
    `/planning/cardexes/${encodeURIComponent(cardexId)}/documents/${encodeURIComponent(documentId)}`,
    { method: "DELETE" },
  );
}

export function downloadCardexDocument(
  cardexId: string,
  documentId: string,
  fallbackFilename: string,
): Promise<void> {
  return downloadBlobAsFile(
    `/planning/cardexes/${encodeURIComponent(cardexId)}/documents/${encodeURIComponent(documentId)}/download`,
    fallbackFilename,
  );
}

export function fetchCardexInvoices(cardexId: string): Promise<StaffCardexInvoicesListResponse> {
  return planningFetch(`/planning/cardexes/${encodeURIComponent(cardexId)}/invoices`);
}

export function downloadCardexInvoicePdf(
  cardexId: string,
  invoiceId: string,
  fallbackFilename: string,
): Promise<void> {
  return downloadBlobAsFile(
    `/planning/cardexes/${encodeURIComponent(cardexId)}/invoices/${encodeURIComponent(invoiceId)}/pdf`,
    fallbackFilename,
  );
}

export type { StaffCardexDocument, StaffCardexInvoice };
