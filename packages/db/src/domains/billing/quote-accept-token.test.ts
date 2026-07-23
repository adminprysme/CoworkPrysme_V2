import { describe, expect, it } from "vitest";

import {
  QUOTE_ACCEPT_TOKEN_MAX_TTL_MS,
  hashQuoteAcceptToken,
  isQuoteAcceptTokenFormat,
  issueQuoteAcceptToken,
  issueQuoteAcceptTokenWithExpiry,
  quoteAcceptTokenMatchesHash,
  resolveQuoteAcceptTokenExpiresAt,
} from "./quote-accept-token.js";

const SECRET = "quote-accept-secret-at-least-32-chars!!";
const OTHER_SECRET = "other-quote-accept-secret-32chars-min";

describe("quote accept token", () => {
  it("issues a 64-char hex raw token and matching hash", () => {
    const issued = issueQuoteAcceptToken(SECRET);
    expect(issued.rawToken).toMatch(/^[a-f0-9]{64}$/);
    expect(isQuoteAcceptTokenFormat(issued.rawToken)).toBe(true);
    expect(issued.tokenHash).toBe(hashQuoteAcceptToken(issued.rawToken, SECRET));
    expect(issued.tokenHash).toHaveLength(64);
  });

  it("hashes with secret pepper — different secrets diverge", () => {
    const raw = "a".repeat(64);
    expect(hashQuoteAcceptToken(raw, SECRET)).not.toBe(hashQuoteAcceptToken(raw, OTHER_SECRET));
  });

  it("matches hash with timing-safe compare", () => {
    const { rawToken, tokenHash } = issueQuoteAcceptToken(SECRET);
    expect(quoteAcceptTokenMatchesHash(rawToken, tokenHash, SECRET)).toBe(true);
    expect(quoteAcceptTokenMatchesHash("b".repeat(64), tokenHash, SECRET)).toBe(false);
    expect(quoteAcceptTokenMatchesHash(rawToken, tokenHash, OTHER_SECRET)).toBe(false);
  });

  it("rejects malformed raw tokens", () => {
    expect(isQuoteAcceptTokenFormat("short")).toBe(false);
    expect(isQuoteAcceptTokenFormat("g".repeat(64))).toBe(false);
    expect(quoteAcceptTokenMatchesHash("short", "a".repeat(64), SECRET)).toBe(false);
  });

  it("issueQuoteAcceptTokenWithExpiry uses min(validUntil, now+30d)", () => {
    const now = new Date("2026-07-23T12:00:00.000Z");
    const sooner = new Date("2026-08-05T00:00:00.000Z");
    const farther = new Date("2027-01-01T00:00:00.000Z");

    const shortLived = issueQuoteAcceptTokenWithExpiry(SECRET, sooner, now);
    expect(shortLived.expiresAt.toISOString()).toBe(sooner.toISOString());
    expect(shortLived.rawToken).toMatch(/^[a-f0-9]{64}$/);

    const capped = issueQuoteAcceptTokenWithExpiry(SECRET, farther, now);
    expect(capped.expiresAt.toISOString()).toBe(
      new Date(now.getTime() + QUOTE_ACCEPT_TOKEN_MAX_TTL_MS).toISOString(),
    );
    expect(resolveQuoteAcceptTokenExpiresAt(farther, now).getTime()).toBe(
      capped.expiresAt.getTime(),
    );
  });
});
