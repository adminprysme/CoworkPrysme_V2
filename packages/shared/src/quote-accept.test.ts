import { describe, expect, it } from "vitest";

import {
  CLIENT_ACCOUNT_ACTIVATION_ERROR_CODES,
  PublicAccountActivationAcceptRequestSchema,
  PublicQuoteAcceptPreviewSchema,
  PublicQuoteAcceptRegisterRequestSchema,
  QUOTE_ACCEPT_ERROR_CODES,
} from "./quote-accept.js";

describe("quote-accept shared DTOs", () => {
  it("exports distinct quote-accept and activation error codes", () => {
    expect(QUOTE_ACCEPT_ERROR_CODES.QUOTE_ACCEPT_NOT_FOUND).toBe("QUOTE_ACCEPT_NOT_FOUND");
    expect(CLIENT_ACCOUNT_ACTIVATION_ERROR_CODES.ACTIVATION_EXPIRED).toBe("ACTIVATION_EXPIRED");
  });

  it("parses a public accept preview", () => {
    expect(
      PublicQuoteAcceptPreviewSchema.parse({
        quoteId: "6a5f3efeebd0da8b88b67bc4",
        reference: "DEV-2026-00001",
        status: "sent",
        validUntil: "2026-08-01T00:00:00.000Z",
        emailMasked: "cl***@example.com",
        needsRegistration: true,
        paymentMethodPreferred: "card",
      }),
    ).toMatchObject({ needsRegistration: true, status: "sent" });
  });

  it("requires CGV + privacy on register-on-accept", () => {
    expect(() =>
      PublicQuoteAcceptRegisterRequestSchema.parse({
        password: "GoodPass1!",
        firstName: "A",
        lastName: "B",
        cgvAccepted: true,
      }),
    ).toThrow();

    expect(
      PublicQuoteAcceptRegisterRequestSchema.parse({
        password: "GoodPass1!",
        firstName: "A",
        lastName: "B",
        privacyPolicyAccepted: true,
        cgvAccepted: true,
      }),
    ).toMatchObject({ firstName: "A", lastName: "B" });
  });

  it("requires password ≥8 on activation accept", () => {
    expect(() => PublicAccountActivationAcceptRequestSchema.parse({ password: "short" })).toThrow();
    expect(PublicAccountActivationAcceptRequestSchema.parse({ password: "GoodPass1!" })).toEqual({
      password: "GoodPass1!",
    });
  });
});
