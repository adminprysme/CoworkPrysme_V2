import {
  PublicQuoteAcceptConfirmLoginRequestSchema,
  PublicQuoteAcceptConfirmRequestSchema,
  PublicQuoteAcceptConfirmResponseSchema,
  PublicQuoteAcceptPreviewSchema,
  QUOTE_ACCEPT_ERROR_CODES,
  type PublicQuoteAcceptConfirmLoginRequest,
  type PublicQuoteAcceptConfirmRequest,
  type PublicQuoteAcceptConfirmResponse,
  type PublicQuoteAcceptPreview,
  type QuoteAcceptErrorCode,
} from "@coworkprysme/shared";

import { getApiBaseUrl } from "./booking-api-client";

const KNOWN_CODES = new Set<string>(Object.values(QUOTE_ACCEPT_ERROR_CODES));

export class QuoteAcceptApiError extends Error {
  readonly code:
    | QuoteAcceptErrorCode
    | "ACCOUNT_PENDING_ACTIVATION"
    | "ACCOUNT_LOCKED"
    | "NETWORK_ERROR"
    | "UNKNOWN";

  constructor(code: QuoteAcceptApiError["code"], message: string) {
    super(message);
    this.name = "QuoteAcceptApiError";
    this.code = code;
  }
}

function extractErrorPayload(json: unknown): { code?: string; message?: string } {
  if (typeof json !== "object" || json === null) return {};
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
  if (typeof root.message === "string") return { message: root.message };
  return {};
}

async function quoteAcceptFetch<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      cache: "no-store",
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new QuoteAcceptApiError("NETWORK_ERROR", "Une erreur est survenue, réessayez plus tard.");
  }

  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const payload = extractErrorPayload(json);
    const code = payload.code;
    if (code === "ACCOUNT_PENDING_ACTIVATION" || code === "ACCOUNT_LOCKED") {
      throw new QuoteAcceptApiError(code, payload.message ?? "Accès refusé.");
    }
    const known = code && KNOWN_CODES.has(code) ? (code as QuoteAcceptErrorCode) : "UNKNOWN";
    throw new QuoteAcceptApiError(
      known,
      payload.message ?? "Une erreur est survenue, réessayez plus tard.",
    );
  }
  return schema.parse(json);
}

export async function fetchQuoteAcceptPreview(token: string): Promise<PublicQuoteAcceptPreview> {
  return quoteAcceptFetch(
    `/quotes/accept/${encodeURIComponent(token)}`,
    PublicQuoteAcceptPreviewSchema,
  );
}

export async function confirmQuoteAccept(
  token: string,
  input: PublicQuoteAcceptConfirmRequest,
): Promise<PublicQuoteAcceptConfirmResponse> {
  PublicQuoteAcceptConfirmRequestSchema.parse(input);
  return quoteAcceptFetch(
    `/quotes/accept/${encodeURIComponent(token)}/confirm`,
    PublicQuoteAcceptConfirmResponseSchema,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function confirmQuoteAcceptLogin(
  token: string,
  input: PublicQuoteAcceptConfirmLoginRequest,
): Promise<PublicQuoteAcceptConfirmResponse> {
  PublicQuoteAcceptConfirmLoginRequestSchema.parse(input);
  return quoteAcceptFetch(
    `/quotes/accept/${encodeURIComponent(token)}/confirm-login`,
    PublicQuoteAcceptConfirmResponseSchema,
    { method: "POST", body: JSON.stringify(input) },
  );
}
