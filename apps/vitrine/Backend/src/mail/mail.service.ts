import { Injectable, Logger } from "@nestjs/common";
import nodemailer from "nodemailer";
import type Transporter from "nodemailer/lib/mailer/index.js";

import { isMailConfigured, loadMailConfig, type MailConfig } from "./mail.config.js";

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}

export interface SendMailResult {
  dryRun: boolean;
  messageId?: string;
  response?: string;
}

/** Honest delivery outcome for audit trails (never throws). */
export interface MailDeliveryOutcome {
  emailSent: boolean;
  /** Present only when emailSent is false — sanitized, no SMTP secrets. */
  emailError?: string;
}

/**
 * Interpret MailService.sendMail result for audit trails.
 * emailSent is true only when response does not start with "error:".
 */
export function mailDeliveryFromResult(result: SendMailResult): MailDeliveryOutcome {
  const response = result.response?.trim() ?? "";
  if (response.startsWith("error:")) {
    return {
      emailSent: false,
      emailError: sanitizeMailErrorMessage(
        response
          .slice("error:".length)
          .trim()
          .replace(/^Error:\s*/i, ""),
      ),
    };
  }
  return { emailSent: true };
}

/** Strip credentials / overly long SMTP dumps before persisting in audit. */
export function sanitizeMailErrorMessage(raw: string): string {
  const cleaned = raw
    .replace(/pass(word)?\s*[:=]\s*\S+/gi, "password=[redacted]")
    .replace(/auth\s*[:=]\s*\S+/gi, "auth=[redacted]")
    .replace(/\bsk_(test|live)_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[email]")
    .trim();
  return cleaned.slice(0, 400) || "envoi email échoué";
}

/** Diff fragment for booking / reservation auditLogs. */
export function emailDeliveryAuditDiff(
  outcome: MailDeliveryOutcome,
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {
    emailSent: { before: false, after: outcome.emailSent },
  };
  if (!outcome.emailSent && outcome.emailError) {
    diff.emailError = { before: null, after: outcome.emailError };
  }
  return diff;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly config: MailConfig;
  private transporter: Transporter | null = null;

  constructor() {
    this.config = loadMailConfig();
    if (isMailConfigured(this.config)) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth:
          this.config.user && this.config.password
            ? { user: this.config.user, pass: this.config.password }
            : undefined,
      });
    } else {
      this.logger.warn("SMTP not configured — emails will be logged (dry-run mode)");
    }
  }

  async sendMail(input: SendMailInput): Promise<SendMailResult> {
    const from = `"${this.config.fromName}" <${this.config.fromAddress}>`;

    const attachmentNames =
      input.attachments
        ?.map((a) => a.filename)
        .filter(Boolean)
        .join(", ") || "(none)";

    if (!this.transporter) {
      this.logger.log(
        `[MAIL DRY-RUN] to=${input.to} subject=${input.subject} attachments=${attachmentNames}\n${input.html.slice(0, 500)}…`,
      );
      return { dryRun: true };
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType ?? "application/pdf",
        })),
      });
      const messageId = typeof info.messageId === "string" ? info.messageId : undefined;
      const response = typeof info.response === "string" ? info.response : undefined;
      this.logger.log(
        `[MAIL SENT] to=${input.to} subject=${input.subject} messageId=${messageId ?? "?"} response=${response ?? "?"} attachments=${attachmentNames}`,
      );
      return { dryRun: false, messageId, response };
    } catch (error) {
      this.logger.error(`Failed to send email to ${input.to}: ${String(error)}`);
      // Do not fail the business mutation when SMTP rejects.
      return { dryRun: false, messageId: undefined, response: `error:${String(error)}` };
    }
  }
}
