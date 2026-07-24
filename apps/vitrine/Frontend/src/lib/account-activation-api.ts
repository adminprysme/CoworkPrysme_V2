import {
  CLIENT_ACCOUNT_ACTIVATION_ERROR_CODES,
  PublicAccountActivationAcceptRequestSchema,
  PublicAccountActivationAcceptResponseSchema,
  PublicAccountActivationPreviewSchema,
  type ClientAccountActivationErrorCode,
  type PublicAccountActivationAcceptRequest,
  type PublicAccountActivationAcceptResponse,
  type PublicAccountActivationPreview,
} from "@coworkprysme/shared";

import { getApiBaseUrl } from "./booking-api-client";

const KNOWN_CODES = new Set<string>(Object.values(CLIENT_ACCOUNT_ACTIVATION_ERROR_CODES));

export class AccountActivationApiError extends Error {
  readonly code: ClientAccountActivationErrorCode | "NETWORK_ERROR" | "UNKNOWN";

  constructor(code: AccountActivationApiError["code"], message: string) {
    super(message);
    this.name = "AccountActivationApiError";
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

async function activationFetch<T>(
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
    throw new AccountActivationApiError(
      "NETWORK_ERROR",
      "Une erreur est survenue, réessayez plus tard.",
    );
  }

  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const payload = extractErrorPayload(json);
    const known =
      payload.code && KNOWN_CODES.has(payload.code)
        ? (payload.code as ClientAccountActivationErrorCode)
        : "UNKNOWN";
    throw new AccountActivationApiError(
      known,
      payload.message ?? "Une erreur est survenue, réessayez plus tard.",
    );
  }
  return schema.parse(json);
}

export async function fetchAccountActivationPreview(
  token: string,
): Promise<PublicAccountActivationPreview> {
  return activationFetch(
    `/account/activation/${encodeURIComponent(token)}`,
    PublicAccountActivationPreviewSchema,
  );
}

export async function acceptAccountActivation(
  token: string,
  input: PublicAccountActivationAcceptRequest,
): Promise<PublicAccountActivationAcceptResponse> {
  PublicAccountActivationAcceptRequestSchema.parse(input);
  return activationFetch(
    `/account/activation/${encodeURIComponent(token)}`,
    PublicAccountActivationAcceptResponseSchema,
    { method: "POST", body: JSON.stringify(input) },
  );
}
