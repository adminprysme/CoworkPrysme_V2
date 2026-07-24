import { describe, expect, it } from "vitest";

import { acceptQuote as domainAcceptQuote } from "@coworkprysme/db";

import { sharedAcceptQuoteDomain } from "./quotes-accept.service.js";

/**
 * Proof point #1: client (vitrine) and staff (gestion) call the exact same
 * domain function — no parallel divergent AcceptQuote implementations.
 */
describe("unified AcceptQuoteService import", () => {
  it("vitrine QuotesAcceptService re-exports the same acceptQuote reference", () => {
    expect(sharedAcceptQuoteDomain).toBe(domainAcceptQuote);
    expect(sharedAcceptQuoteDomain.name).toBe("acceptQuote");
  });
});
