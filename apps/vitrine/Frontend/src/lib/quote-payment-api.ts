import {
  CreateQuotePaymentIntentResponseSchema,
  QUOTE_PAYMENT_LINK_ERROR_CODES,
  QuotePaymentLinkPreviewSchema,
  QuotePaymentStatusResponseSchema,
  type CreateQuotePaymentIntentResponse,
  type QuotePaymentLinkErrorCode,
  type QuotePaymentLinkPreview,
  type QuotePaymentStatusResponse,
} from "@coworkprysme/shared";

import { getApiBaseUrl } from "./booking-api-client";

const KNOWN_CODES = new Set<string>(Object.values(QUOTE_PAYMENT_LINK_ERROR_CODES));

export class QuotePaymentApiError extends Error {
  readonly code: QuotePaymentLinkErrorCode | "NETWORK_ERROR" | "UNKNOWN";

  constructor(code: QuotePaymentApiError["code"], message: string) {
    super(message);
    this.name = "QuotePaymentApiError";
    this.code = code;
  }
}

function extractErrorPayload(json: unknown): { code?: string; message?: string } {
  if (typeof json !== "object" || json === null) {
    return {};
  }
  const root = json as Record<string, unknown>;
  if (typeof root.code === "string" && typeof root.message === "string") {
    return { code: root.code, message: root.message };
  }
  if (typeof root.message === "object" && root.message !== null) {
    const nested = root.message as Record<string, unknown>;
    return {
      code: typeof nested.code === "string" ? nested.code : undefined,
      message: typeof nested.message === "string" ? nested.message : undefined,
    };
  }
  return {};
}

async function quotePaymentFetch(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new QuotePaymentApiError("NETWORK_ERROR", "Impossible de joindre le serveur.");
  }

  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const { code, message } = extractErrorPayload(json);
    const known = code && KNOWN_CODES.has(code) ? (code as QuotePaymentLinkErrorCode) : "UNKNOWN";
    throw new QuotePaymentApiError(known, message ?? "Erreur de paiement.");
  }
  return json;
}

export async function fetchQuotePaymentPreview(
  token: string,
  invoiceId: string,
): Promise<QuotePaymentLinkPreview> {
  const qs = new URLSearchParams({ token, invoiceId });
  const json = await quotePaymentFetch(`/quotes/payments/preview?${qs.toString()}`);
  return QuotePaymentLinkPreviewSchema.parse(json);
}

export async function createQuotePaymentIntent(
  token: string,
  invoiceId: string,
): Promise<CreateQuotePaymentIntentResponse> {
  const json = await quotePaymentFetch("/quotes/payments/intent", {
    method: "POST",
    body: JSON.stringify({ token, invoiceId }),
  });
  return CreateQuotePaymentIntentResponseSchema.parse(json);
}

export async function fetchQuotePaymentStatus(
  token: string,
  invoiceId: string,
): Promise<QuotePaymentStatusResponse> {
  const qs = new URLSearchParams({ token, invoiceId });
  const json = await quotePaymentFetch(`/quotes/payments/status?${qs.toString()}`);
  return QuotePaymentStatusResponseSchema.parse(json);
}
