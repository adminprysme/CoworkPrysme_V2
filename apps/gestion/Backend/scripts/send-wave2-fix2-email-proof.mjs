/**
 * Wave 2-fix2 proof — cancellation email with zero refund (no monetary figures).
 *
 * Usage (from apps/gestion/Backend):
 *   node --env-file=.env scripts/send-wave2-fix2-email-proof.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import nodemailer from "nodemailer";

import { renderCancellationEmail } from "../dist/planning/planning-manage-emails.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "..", "tmp", "wave2-fix2-email-proof");
mkdirSync(OUT, { recursive: true });

const to = process.env.EMAIL_TO?.trim() || "team-comm@prysme.eu";

if (!process.env.SMTP_HOST) {
  throw new Error("SMTP_HOST missing — refuse dry-run for Wave2-fix2 proof");
}

const email = renderCancellationEmail({
  reservationReference: "RES-2026-PROOF-W2-FIX2-CANCEL",
  spaceName: "FOCUS",
  startAt: "26/09/2026 08:00",
  endAt: "25/10/2026 20:00",
  paidTotalCents: 23999,
  refundCents: 0,
});

if (/€|EUR|remboursement|Montant réglé|239/i.test(email.html)) {
  throw new Error("Cancel no-refund email still contains a monetary figure");
}

const subject = `[PROOF Wave2-fix2] ${email.subject}`;
const html = `${email.html}<p style="margin-top:24px;font-size:12px;color:#666;">PROOF Wave2-fix2 id=<code>cancellation-no-refund</code> — Annulation sans aucun chiffre</p>`;
writeFileSync(join(OUT, "cancellation-no-refund.html"), html);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
});
const from = `"${process.env.SMTP_FROM_NAME ?? "Cowork Prysme"}" <${process.env.SMTP_FROM_ADDRESS ?? process.env.SMTP_USER}>`;

const info = await transporter.sendMail({ from, to, subject, html });
const summary = {
  id: "cancellation-no-refund",
  to,
  subject,
  messageId: info.messageId,
  response: info.response,
  accepted: info.accepted,
  rejected: info.rejected,
};
writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
console.log("SENT", JSON.stringify(summary));
