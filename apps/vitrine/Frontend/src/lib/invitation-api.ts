import {
  CLIENT_INVITATION_ERROR_CODES,
  PublicInvitationAcceptRequestSchema,
  PublicInvitationAcceptResponseSchema,
  PublicInvitationPreviewSchema,
  type ClientInvitationErrorCode,
  type PublicInvitationAcceptRequest,
  type PublicInvitationAcceptResponse,
  type PublicInvitationPreview,
} from "@coworkprysme/shared";

import { getApiBaseUrl } from "./booking-api-client";

const KNOWN_CODES = new Set<string>(Object.values(CLIENT_INVITATION_ERROR_CODES));

export class InvitationApiError extends Error {
  readonly code: ClientInvitationErrorCode | "NETWORK_ERROR" | "UNKNOWN";

  constructor(code: InvitationApiError["code"], message: string) {
    super(message);
    this.name = "InvitationApiError";
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
  if (typeof root.message === "string") {
    return { message: root.message };
  }
  return {};
}

async function invitationFetch<T>(
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
    throw new InvitationApiError("NETWORK_ERROR", "Une erreur est survenue, réessayez plus tard.");
  }

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const payload = extractErrorPayload(json);
    const code =
      payload.code && KNOWN_CODES.has(payload.code)
        ? (payload.code as ClientInvitationErrorCode)
        : "UNKNOWN";
    throw new InvitationApiError(
      code,
      payload.message ?? "Une erreur est survenue, réessayez plus tard.",
    );
  }

  return schema.parse(json);
}

export async function fetchInvitationPreview(token: string): Promise<PublicInvitationPreview> {
  return invitationFetch(
    `/invitations/${encodeURIComponent(token)}`,
    PublicInvitationPreviewSchema,
  );
}

export async function acceptInvitation(
  token: string,
  input: PublicInvitationAcceptRequest,
): Promise<PublicInvitationAcceptResponse> {
  PublicInvitationAcceptRequestSchema.parse(input);
  return invitationFetch(
    `/invitations/${encodeURIComponent(token)}/accept`,
    PublicInvitationAcceptResponseSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
