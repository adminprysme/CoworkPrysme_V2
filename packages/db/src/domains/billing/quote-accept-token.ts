import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** SHA-256(token + ":" + QUOTE_ACCEPT_TOKEN_SECRET) — never store or log the raw token. */
export function hashQuoteAcceptToken(rawToken: string, secret: string): string {
  return createHash("sha256").update(`${rawToken}:${secret}`).digest("hex");
}

const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

/** Raw accept tokens are 32 bytes hex (64 chars). */
export function isQuoteAcceptTokenFormat(rawToken: string): boolean {
  return TOKEN_PATTERN.test(rawToken);
}

export interface IssuedQuoteAcceptToken {
  rawToken: string;
  tokenHash: string;
}

/** Issues an opaque accept token. Caller stores only `tokenHash` (+ expiresAt). */
export function issueQuoteAcceptToken(secret: string): IssuedQuoteAcceptToken {
  const rawToken = randomBytes(32).toString("hex");
  return {
    rawToken,
    tokenHash: hashQuoteAcceptToken(rawToken, secret),
  };
}

/** Timing-safe compare of raw token against a stored hash. */
export function quoteAcceptTokenMatchesHash(
  rawToken: string,
  tokenHash: string,
  secret: string,
): boolean {
  if (!isQuoteAcceptTokenFormat(rawToken) || !TOKEN_PATTERN.test(tokenHash)) {
    return false;
  }
  const computed = Buffer.from(hashQuoteAcceptToken(rawToken, secret), "utf8");
  const expected = Buffer.from(tokenHash.toLowerCase(), "utf8");
  if (computed.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(computed, expected);
}
