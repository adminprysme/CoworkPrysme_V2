import { describe, expect, it } from "vitest";

import {
  BillingLineKindSchema,
  QUOTE_ACCEPT_TOKEN_MAX_TTL_MS,
  QuoteDepositPercentSchema,
  QuotePaymentMethodSchema,
  QuoteProspectSchema,
  QuoteSendProspectSchema,
  QuoteStatusSchema,
  resolveQuoteAcceptTokenExpiresAt,
} from "./billing-quotes.js";

describe("billing-quotes schemas", () => {
  it("includes draft in quote statuses", () => {
    expect(QuoteStatusSchema.options).toEqual(["draft", "sent", "accepted", "refused", "expired"]);
  });

  it("accepts quote payment methods including direct_debit stub", () => {
    expect(QuotePaymentMethodSchema.parse("card")).toBe("card");
    expect(QuotePaymentMethodSchema.parse("bank_transfer")).toBe("bank_transfer");
    expect(QuotePaymentMethodSchema.parse("direct_debit")).toBe("direct_debit");
  });

  it("validates depositPercent 0–100 integers", () => {
    expect(QuoteDepositPercentSchema.parse(0)).toBe(0);
    expect(QuoteDepositPercentSchema.parse(30)).toBe(30);
    expect(QuoteDepositPercentSchema.parse(100)).toBe(100);
    expect(() => QuoteDepositPercentSchema.parse(101)).toThrow();
    expect(() => QuoteDepositPercentSchema.parse(-1)).toThrow();
    expect(() => QuoteDepositPercentSchema.parse(12.5)).toThrow();
  });

  it("requires email on draft prospect and lowercases it", () => {
    expect(QuoteProspectSchema.parse({ email: "  Client@Example.COM " })).toEqual({
      email: "client@example.com",
    });
    expect(() => QuoteProspectSchema.parse({})).toThrow();
  });

  it("QuoteSendProspectSchema requires (firstName+lastName) OR displayName", () => {
    expect(() => QuoteSendProspectSchema.parse({ email: "a@example.com" })).toThrow();
    expect(() =>
      QuoteSendProspectSchema.parse({ email: "a@example.com", firstName: "Only" }),
    ).toThrow();
    expect(
      QuoteSendProspectSchema.parse({
        email: "a@example.com",
        firstName: "Alice",
        lastName: "Martin",
      }),
    ).toMatchObject({ firstName: "Alice", lastName: "Martin" });
    expect(
      QuoteSendProspectSchema.parse({
        email: "a@example.com",
        displayName: "Alice Martin",
      }),
    ).toMatchObject({ displayName: "Alice Martin" });
  });

  it("resolveQuoteAcceptTokenExpiresAt = min(validUntil, now+30d)", () => {
    expect(QUOTE_ACCEPT_TOKEN_MAX_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
    const now = new Date("2026-07-23T12:00:00.000Z");
    const in10Days = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const in6Months = new Date(now.getTime() + 183 * 24 * 60 * 60 * 1000); // ~6 months
    expect(resolveQuoteAcceptTokenExpiresAt(in10Days, now).toISOString()).toBe(
      in10Days.toISOString(),
    );
    expect(resolveQuoteAcceptTokenExpiresAt(in6Months, now).toISOString()).toBe(
      new Date(now.getTime() + QUOTE_ACCEPT_TOKEN_MAX_TTL_MS).toISOString(),
    );
  });

  it("mirrors billing line kinds", () => {
    expect(BillingLineKindSchema.options).toContain("space");
    expect(BillingLineKindSchema.options).toContain("service");
  });
});
