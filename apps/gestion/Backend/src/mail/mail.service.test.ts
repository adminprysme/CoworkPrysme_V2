import { describe, expect, it } from "vitest";

import {
  emailDeliveryAuditDiff,
  mailDeliveryFromResult,
  sanitizeMailErrorMessage,
} from "./mail.service.js";

describe("mailDeliveryFromResult", () => {
  it("marks success when response has no error prefix", () => {
    expect(mailDeliveryFromResult({ dryRun: false, response: "250 OK" })).toEqual({
      emailSent: true,
    });
  });

  it("marks success for dry-run (no SMTP response)", () => {
    expect(mailDeliveryFromResult({ dryRun: true })).toEqual({ emailSent: true });
  });

  it("marks failure when response starts with error:", () => {
    const outcome = mailDeliveryFromResult({
      dryRun: false,
      response: "error:Error: Recipient address reserved by RFC 2606",
    });
    expect(outcome.emailSent).toBe(false);
    expect(outcome.emailError).toContain("RFC 2606");
    expect(outcome.emailError).not.toMatch(/^Error:/);
  });
});

describe("sanitizeMailErrorMessage", () => {
  it("redacts emails and secrets", () => {
    const cleaned = sanitizeMailErrorMessage(
      "fail for bad@example.com password=secret sk_test_abc123",
    );
    expect(cleaned).not.toContain("bad@example.com");
    expect(cleaned).not.toContain("secret");
    expect(cleaned).not.toContain("sk_test_abc123");
    expect(cleaned).toContain("[email]");
    expect(cleaned).toContain("[redacted]");
  });
});

describe("emailDeliveryAuditDiff", () => {
  it("includes emailError only on failure", () => {
    expect(emailDeliveryAuditDiff({ emailSent: true })).toEqual({
      emailSent: { before: false, after: true },
    });
    expect(emailDeliveryAuditDiff({ emailSent: false, emailError: "SMTP rejected" })).toEqual({
      emailSent: { before: false, after: false },
      emailError: { before: null, after: "SMTP rejected" },
    });
  });
});
