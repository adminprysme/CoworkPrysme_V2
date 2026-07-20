/**
 * Wave 2-fix proof — send « sans montant » variants of manage emails.
 *
 * Usage (from apps/gestion/Backend):
 *   node --env-file=.env scripts/send-wave2-fix-email-proof.mjs
 *
 * Env:
 *   EMAIL_TO=team-comm@prysme.eu (default)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import nodemailer from "nodemailer";

import {
  renderCancellationEmail,
  renderSpaceChangeEmail,
} from "../dist/planning/planning-manage-emails.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "..", "tmp", "wave2-fix-email-proof");
mkdirSync(OUT, { recursive: true });

const to = process.env.EMAIL_TO?.trim() || "team-comm@prysme.eu";

const cases = [
  {
    id: "space-change-no-bill",
    label: "Changement de salle — différence NON facturée (aucun montant)",
    build: () => {
      const email = renderSpaceChangeEmail({
        reservationReference: "RES-2026-PROOF-W2-FIX-SPACE",
        previousSpaceName: "FOCUS",
        nextSpaceName: "FOCUS 2 (test manage)",
        startAt: "26/09/2026 08:00",
        endAt: "25/10/2026 20:00",
        previousTotalTTC: 23999,
        nextTotalTTC: 28799,
        deltaTTC: 4800,
        billedDifference: false,
      });
      return {
        subject: `[PROOF Wave2-fix] ${email.subject}`,
        html: email.html,
      };
    },
  },
  {
    id: "cancellation-no-refund",
    label: "Annulation — mode Ne pas rembourser (aucun montant de remboursement)",
    build: () => {
      const email = renderCancellationEmail({
        reservationReference: "RES-2026-PROOF-W2-FIX-CANCEL",
        spaceName: "FOCUS",
        startAt: "26/09/2026 08:00",
        endAt: "25/10/2026 20:00",
        paidTotalCents: 23999,
        refundCents: 0,
      });
      return {
        subject: `[PROOF Wave2-fix] ${email.subject}`,
        html: email.html,
      };
    },
  },
];

if (!process.env.SMTP_HOST) {
  throw new Error("SMTP_HOST missing — refuse dry-run for Wave2-fix proof");
}

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

const summary = [];
for (const c of cases) {
  const mail = c.build();
  const html = `${mail.html}<p style="margin-top:24px;font-size:12px;color:#666;">PROOF Wave2-fix id=<code>${c.id}</code> — ${c.label}</p>`;
  writeFileSync(join(OUT, `${c.id}.html`), html);

  // Guard: sans-montant variants must not leak refund/delta copy
  if (c.id === "space-change-no-bill" && /ajusté|supérieur|inférieur|Nouveau montant/i.test(mail.html)) {
    throw new Error(`Space-change sans montant still contains price copy (${c.id})`);
  }
  if (c.id === "cancellation-no-refund" && /remboursement/i.test(mail.html)) {
    throw new Error(`Cancel sans remboursement still mentions refund (${c.id})`);
  }

  const info = await transporter.sendMail({
    from,
    to,
    subject: mail.subject,
    html,
  });
  const entry = {
    id: c.id,
    label: c.label,
    to,
    subject: mail.subject,
    messageId: info.messageId,
    response: info.response,
    accepted: info.accepted,
    rejected: info.rejected,
  };
  summary.push(entry);
  console.log("SENT", JSON.stringify(entry));
}

writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
console.log("Wrote", join(OUT, "summary.json"));
