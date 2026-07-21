import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({
        messageId: "<test-id@prysme.eu>",
        response: "250 2.0.0 OK",
      }),
    })),
  },
}));

import {
  emailDeliveryAuditDiff,
  mailDeliveryFromResult,
  MailService,
  sanitizeMailErrorMessage,
} from "./mail.service.js";

describe("mailDeliveryFromResult", () => {
  it("treats SMTP 250 as sent", () => {
    expect(mailDeliveryFromResult({ dryRun: false, response: "250 OK" })).toEqual({
      emailSent: true,
    });
  });

  it("treats dry-run as sent", () => {
    expect(mailDeliveryFromResult({ dryRun: true })).toEqual({ emailSent: true });
  });

  it("treats error: responses as not sent", () => {
    const outcome = mailDeliveryFromResult({
      dryRun: false,
      response: "error:Error: Invalid login",
    });
    expect(outcome.emailSent).toBe(false);
    expect(outcome.emailError).toBeTruthy();
  });
});

describe("sanitizeMailErrorMessage", () => {
  it("redacts password-looking fragments", () => {
    const cleaned = sanitizeMailErrorMessage("auth failed password=secret123 more");
    expect(cleaned).not.toContain("secret123");
    expect(cleaned).toContain("password=[redacted]");
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

describe("MailService", () => {
  it("logs dry-run output when SMTP_HOST is not configured", async () => {
    delete process.env.SMTP_HOST;
    const service = new MailService();
    const logSpy = vi.spyOn(Logger.prototype, "log");

    const result = await service.sendMail({
      to: "client@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result.dryRun).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[MAIL DRY-RUN]"));
  });

  it("returns messageId and logs [MAIL SENT] when SMTP is configured", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    const service = new MailService();
    const logSpy = vi.spyOn(Logger.prototype, "log");

    const result = await service.sendMail({
      to: "client@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result.dryRun).toBe(false);
    expect(result.messageId).toBe("<test-id@prysme.eu>");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[MAIL SENT]"));
  });
});
