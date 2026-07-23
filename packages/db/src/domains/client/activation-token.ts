import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** SHA-256(token + ":" + CLIENT_ACCOUNT_ACTIVATION_TOKEN_SECRET) — never store raw. */
export function hashClientAccountActivationToken(rawToken: string, secret: string): string {
  return createHash("sha256").update(`${rawToken}:${secret}`).digest("hex");
}

const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

/** Raw activation tokens are 32 bytes hex (64 chars). */
export function isClientAccountActivationTokenFormat(rawToken: string): boolean {
  return TOKEN_PATTERN.test(rawToken);
}

export interface IssuedClientAccountActivationToken {
  rawToken: string;
  tokenHash: string;
}

/** Issues an opaque activation token. Caller stores only `tokenHash` (+ expiresAt). */
export function issueClientAccountActivationToken(
  secret: string,
): IssuedClientAccountActivationToken {
  const rawToken = randomBytes(32).toString("hex");
  return {
    rawToken,
    tokenHash: hashClientAccountActivationToken(rawToken, secret),
  };
}

/** Timing-safe compare of raw token against a stored hash. */
export function activationTokenMatchesHash(
  rawToken: string,
  tokenHash: string,
  secret: string,
): boolean {
  if (!isClientAccountActivationTokenFormat(rawToken) || !TOKEN_PATTERN.test(tokenHash)) {
    return false;
  }
  const computed = Buffer.from(hashClientAccountActivationToken(rawToken, secret), "utf8");
  const expected = Buffer.from(tokenHash.toLowerCase(), "utf8");
  if (computed.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(computed, expected);
}
