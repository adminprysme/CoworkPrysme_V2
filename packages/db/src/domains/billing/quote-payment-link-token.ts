import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * SHA-256(token + ":" + QUOTE_PAYMENT_LINK_TOKEN_SECRET).
 * Dedicated pepper — never reuse SESSION / BOOKING_PAYMENT / CLIENT_INVITE /
 * QUOTE_ACCEPT / CLIENT_ACCOUNT_ACTIVATION secrets.
 */
export function hashQuotePaymentLinkToken(rawToken: string, secret: string): string {
  return createHash("sha256").update(`${rawToken}:${secret}`).digest("hex");
}

const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

/** Raw payment-link tokens are 32 bytes hex (64 chars). */
export function isQuotePaymentLinkTokenFormat(rawToken: string): boolean {
  return TOKEN_PATTERN.test(rawToken);
}

export interface IssuedQuotePaymentLinkToken {
  rawToken: string;
  tokenHash: string;
}

/** Issues an opaque payment-link token. Caller stores only `tokenHash`. */
export function issueQuotePaymentLinkToken(secret: string): IssuedQuotePaymentLinkToken {
  const rawToken = randomBytes(32).toString("hex");
  return {
    rawToken,
    tokenHash: hashQuotePaymentLinkToken(rawToken, secret),
  };
}

/** Timing-safe compare of raw token against a stored hash. */
export function quotePaymentLinkTokenMatchesHash(
  rawToken: string,
  tokenHash: string,
  secret: string,
): boolean {
  if (!isQuotePaymentLinkTokenFormat(rawToken) || !TOKEN_PATTERN.test(tokenHash)) {
    return false;
  }
  const computed = Buffer.from(hashQuotePaymentLinkToken(rawToken, secret), "utf8");
  const expected = Buffer.from(tokenHash.toLowerCase(), "utf8");
  if (computed.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(computed, expected);
}
