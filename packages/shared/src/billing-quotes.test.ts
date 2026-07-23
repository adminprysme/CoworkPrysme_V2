import { describe, expect, it } from "vitest";

import {
  BillingLineKindSchema,
  QuoteDepositPercentSchema,
  QuotePaymentMethodSchema,
  QuoteProspectSchema,
  QuoteStatusSchema,
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

  it("requires email on prospect and lowercases it", () => {
    expect(QuoteProspectSchema.parse({ email: "  Client@Example.COM " })).toEqual({
      email: "client@example.com",
    });
    expect(() => QuoteProspectSchema.parse({})).toThrow();
  });

  it("mirrors billing line kinds", () => {
    expect(BillingLineKindSchema.options).toContain("space");
    expect(BillingLineKindSchema.options).toContain("service");
  });
});
