import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: "test-id" }),
    })),
  },
}));

import { MailService } from "./mail.service.js";

describe("MailService", () => {
  it("logs dry-run output when SMTP_HOST is not configured", async () => {
    delete process.env.SMTP_HOST;
    const service = new MailService();
    const logSpy = vi.spyOn(Logger.prototype, "log");

    await service.sendMail({
      to: "client@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[MAIL DRY-RUN]"));
  });
});
