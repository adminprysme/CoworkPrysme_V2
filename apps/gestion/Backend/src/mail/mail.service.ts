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
        `[MAIL SENT] to=${input.to} subject=${input.subject} messageId=${messageId ?? "?"} response=${response ?? "?"}`,
      );
      return { dryRun: false, messageId, response };
    } catch (error) {
      this.logger.error(`Failed to send email to ${input.to}: ${String(error)}`);
      // Do not fail the business mutation (cancel/refund) when SMTP rejects.
      return { dryRun: false, messageId: undefined, response: `error:${String(error)}` };
    }
  }
}
