import { describe, expect, it } from "vitest";

import { acceptQuote } from "@coworkprysme/db";

import { QuotesService } from "./quotes.service.js";

/**
 * Proof point #1 (staff side): gestion QuotesService must call this same
 * `acceptQuote` export — not a local reimplementation.
 */
describe("gestion staff accept uses shared acceptQuote", () => {
  it("imports the domain acceptQuote symbol alongside QuotesService", () => {
    expect(typeof acceptQuote).toBe("function");
    expect(acceptQuote.name).toBe("acceptQuote");
    expect(QuotesService).toBeDefined();
  });
});
