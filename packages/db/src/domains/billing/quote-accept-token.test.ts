import { describe, expect, it } from "vitest";

import {
  hashQuoteAcceptToken,
  isQuoteAcceptTokenFormat,
  issueQuoteAcceptToken,
  quoteAcceptTokenMatchesHash,
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
});
