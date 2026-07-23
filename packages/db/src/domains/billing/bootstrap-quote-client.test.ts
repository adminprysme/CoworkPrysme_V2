import { describe, expect, it } from "vitest";

import { QuoteBootstrapError, resolveProspectIdentity } from "./bootstrap-quote-client.js";

describe("resolveProspectIdentity", () => {
  it("uses firstName + lastName when present", () => {
    expect(
      resolveProspectIdentity({
        email: "a@example.com",
        firstName: " Alice ",
        lastName: " Martin ",
        phone: "0612345678",
      }),
    ).toEqual({ firstName: "Alice", lastName: "Martin", phone: "0612345678" });
  });

  it("splits displayName when first/last missing", () => {
    expect(
      resolveProspectIdentity({
        email: "a@example.com",
        displayName: "Bob Dupont",
      }),
    ).toEqual({ firstName: "Bob", lastName: "Dupont" });
  });

  it("duplicates single-token displayName for both names", () => {
    expect(
      resolveProspectIdentity({
        email: "a@example.com",
        displayName: "Mononyme",
      }),
    ).toEqual({ firstName: "Mononyme", lastName: "Mononyme" });
  });

  it("returns null when identity cannot be derived", () => {
    expect(resolveProspectIdentity({ email: "a@example.com" })).toBeNull();
  });
});

describe("QuoteBootstrapError", () => {
  it("carries a typed code", () => {
    const err = new QuoteBootstrapError("PROSPECT_REQUIRED", "missing");
    expect(err.code).toBe("PROSPECT_REQUIRED");
    expect(err.name).toBe("QuoteBootstrapError");
  });
});
