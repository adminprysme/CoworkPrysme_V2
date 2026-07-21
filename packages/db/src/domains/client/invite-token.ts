import { createHash } from "node:crypto";

/** SHA-256(token + ":" + CLIENT_INVITE_TOKEN_SECRET) — never store or log the raw token. */
export function hashClientInviteToken(rawToken: string, secret: string): string {
  return createHash("sha256").update(`${rawToken}:${secret}`).digest("hex");
}

const INVITE_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

/** Raw invite tokens are 32 bytes hex (64 chars). */
export function isClientInviteTokenFormat(rawToken: string): boolean {
  return INVITE_TOKEN_PATTERN.test(rawToken);
}
