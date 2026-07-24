import { describe, expect, it } from "vitest";

import { resolveQuotePaymentLinkAmountCents } from "./quote-payment-link-amount.js";
import {
  hashQuotePaymentLinkToken,
  isQuotePaymentLinkTokenFormat,
  issueQuotePaymentLinkToken,
  quotePaymentLinkTokenMatchesHash,
} from "./quote-payment-link-token.js";

const SECRET = "p".repeat(32);
const OTHER = "x".repeat(32);

describe("quote payment link token (point 1)", () => {
  it("issues opaque 64-hex token and stores only hash with dedicated secret", () => {
    const issued = issueQuotePaymentLinkToken(SECRET);
    expect(isQuotePaymentLinkTokenFormat(issued.rawToken)).toBe(true);
    expect(issued.tokenHash).toBe(hashQuotePaymentLinkToken(issued.rawToken, SECRET));
    expect(issued.tokenHash).not.toBe(issued.rawToken);
    expect(quotePaymentLinkTokenMatchesHash(issued.rawToken, issued.tokenHash, SECRET)).toBe(true);
  });

  it("does not match when hashed with a different secret (SESSION/INVITE/etc.)", () => {
    const issued = issueQuotePaymentLinkToken(SECRET);
    expect(hashQuotePaymentLinkToken(issued.rawToken, OTHER)).not.toBe(issued.tokenHash);
    expect(quotePaymentLinkTokenMatchesHash(issued.rawToken, issued.tokenHash, OTHER)).toBe(false);
  });
});

describe("resolveQuotePaymentLinkAmountCents (point 2 / LOCKED #5)", () => {
  it("uses depositAmountTTC when depositPercent > 0", () => {
    expect(
      resolveQuotePaymentLinkAmountCents({
        depositPercent: 30,
        depositAmountTTC: 3600,
        totals: { ttc: 12_000 },
      }),
    ).toBe(3600);
  });

  it("falls back to percent of TTC when deposit snapshot missing", () => {
    expect(
      resolveQuotePaymentLinkAmountCents({
        depositPercent: 30,
        totals: { ttc: 10_000 },
      }),
    ).toBe(3000);
  });

  it("uses full TTC when depositPercent is 0 / absent", () => {
    expect(
      resolveQuotePaymentLinkAmountCents({
        depositPercent: 0,
        depositAmountTTC: 3600,
        totals: { ttc: 12_000 },
      }),
    ).toBe(12_000);
    expect(
      resolveQuotePaymentLinkAmountCents({
        totals: { ttc: 4800 },
      }),
    ).toBe(4800);
  });
});
