import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOGO_PATH = join(MODULE_DIR, "assets", "logo-cowork-prysme.png");

export function resolveInvoiceLogoPath(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.INVOICE_LOGO_PATH?.trim();
  if (!configured) return DEFAULT_LOGO_PATH;
  return isAbsolute(configured) ? configured : join(process.cwd(), configured);
}

export function loadInvoiceLogoDataUri(env: NodeJS.ProcessEnv = process.env): string {
  const path = resolveInvoiceLogoPath(env);
  const buffer = readFileSync(path);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}
