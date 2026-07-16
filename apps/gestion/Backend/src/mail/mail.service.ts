import { Injectable, Logger } from "@nestjs/common";
import nodemailer from "nodemailer";
import type Transporter from "nodemailer/lib/mailer/index.js";

import { isMailConfigured, loadMailConfig, type MailConfig } from "./mail.config.js";

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
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

  async sendMail(input: SendMailInput): Promise<void> {
    const from = `"${this.config.fromName}" <${this.config.fromAddress}>`;

    if (!this.transporter) {
      this.logger.log(
        `[MAIL DRY-RUN] to=${input.to} subject=${input.subject}\n${input.html.slice(0, 500)}…`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      });
    } catch (error) {
      this.logger.error(`Failed to send email to ${input.to}: ${String(error)}`);
    }
  }
}
