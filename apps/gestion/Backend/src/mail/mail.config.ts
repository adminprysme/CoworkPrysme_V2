export interface MailConfig {
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  fromAddress: string;
  fromName: string;
}

export function loadMailConfig(): MailConfig {
  const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
  return {
    host: process.env.SMTP_HOST?.trim() || undefined,
    port: Number.isFinite(port) ? port : 587,
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER?.trim() || undefined,
    password: process.env.SMTP_PASSWORD?.trim() || undefined,
    fromAddress: process.env.SMTP_FROM_ADDRESS?.trim() || "noreply@prysme.eu",
    fromName: process.env.SMTP_FROM_NAME?.trim() || "Cowork Prysme",
  };
}

export function isMailConfigured(config: MailConfig): boolean {
  return Boolean(config.host);
}
