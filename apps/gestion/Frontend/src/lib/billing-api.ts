import type {
  BankTransferPendingLookupResponse,
  BankTransferTransfersResponse,
  MarkBankTransferReceivedRequest,
  MarkBankTransferReceivedResponse,
} from "@coworkprysme/shared";

import { API_URL } from "./api.js";

async function billingFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

export function listBankTransfers(validatedDays?: number): Promise<BankTransferTransfersResponse> {
  const qs = new URLSearchParams();
  if (typeof validatedDays === "number") {
    qs.set("validatedDays", String(validatedDays));
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  return billingFetch<BankTransferTransfersResponse>(`/billing/transfers${suffix}`);
}

export function lookupBankTransfer(reference: string): Promise<BankTransferPendingLookupResponse> {
  const qs = new URLSearchParams({ reference });
  return billingFetch<BankTransferPendingLookupResponse>(`/billing/transfers/lookup?${qs}`);
}

export function markBankTransferReceived(
  input: MarkBankTransferReceivedRequest,
): Promise<MarkBankTransferReceivedResponse> {
  return billingFetch<MarkBankTransferReceivedResponse>("/billing/transfers/mark-received", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
