/**
 * Phase 2 E2E proof — send the 3 confirmation emails with real PDF attachments
 * to a mailbox for visual verification.
 *
 * Usage (from apps/vitrine/Backend):
 *   node --env-file=.env scripts/send-invoice-pdf-email-proof.mjs
 *
 * Env:
 *   EMAIL_TO=team-comm@prysme.eu (default)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import nodemailer from "nodemailer";
import { InvoicePdfService } from "@coworkprysme/invoice-pdf";
import { renderPaymentConfirmedEmail } from "@coworkprysme/shared";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "..", "tmp", "invoice-pdf-email-proof");
mkdirSync(OUT, { recursive: true });

const to = process.env.EMAIL_TO?.trim() || "team-comm@prysme.eu";

const { renderBankTransferInstructionsEmail: renderBtInstructions } = await import(
  "../dist/mail/templates/booking-emails.js"
);

const pdfService = new InvoicePdfService();

async function gen(ref) {
  const result = await pdfService.generatePdfForInvoiceReference(ref);
  if (!result.pdf.subarray(0, 4).equals(Buffer.from("%PDF"))) {
    throw new Error(`Not a PDF for ${ref}`);
  }
  const path = join(OUT, `${ref}.pdf`);
  writeFileSync(path, result.pdf);
  return { ...result, path };
}

const unpaidRef = process.env.PROOF_PROFORMA_REF?.trim() || "PF-2026-00018";
const paidCardRef = process.env.PROOF_CARD_REF?.trim() || "PF-2026-00022";
const paidBtRef = process.env.PROOF_BT_PAID_REF?.trim() || "PF-2026-00019";

const cases = [
  {
    id: "proforma-instructions",
    label: "Proforma classique (instructions virement J+0) — facture NON payée",
    ref: unpaidRef,
    build: (pdf, model) => {
      const email = renderBtInstructions({
        reservationReference: model.reservationReference ?? "RES-PROOF",
        invoiceReference: model.invoiceReference,
        spaceName: model.lines[0]?.label ?? "Espace",
        startAt: "20/07/2026 10:00:00",
        endAt: "20/07/2026 11:00:00",
        amountCents: model.totals.ttc,
        expiresAtLabel: "28/07/2026 10:00:00",
        iban: model.bankRib?.iban ?? "FR76…",
        bic: model.bankRib?.bic ?? "XXXX",
        accountHolder: model.bankRib?.accountHolder ?? "CG DEVELOPPEMENT",
        bankName: model.bankRib?.bankName,
        transferLabel: model.reservationReference ?? model.invoiceReference,
        building: {
          name: "Cowork Prysme",
          addressFull: "Lyon",
        },
      });
      return {
        subject: `[PROOF Phase2] ${email.subject}`,
        html: email.html,
        attachments: [{ filename: `${model.invoiceReference}.pdf`, content: pdf }],
      };
    },
  },
  {
    id: "card-paid",
    label: "Confirmation carte payée",
    ref: paidCardRef,
    build: (pdf, model) => {
      const email = renderPaymentConfirmedEmail({
        reservationReference: model.reservationReference ?? "RES-PROOF-CARD",
        invoiceReference: model.invoiceReference,
        spaceName: model.lines[0]?.label ?? "Espace",
        startAt: "20/07/2026 10:00:00",
        endAt: "20/07/2026 11:00:00",
        totalTTC: model.totals.ttc,
        paymentMethod: "card",
        building: {
          name: "Cowork Prysme",
          addressFull: "Lyon",
        },
      });
      return {
        subject: `[PROOF Phase2] ${email.subject}`,
        html: email.html,
        attachments: [{ filename: `${model.invoiceReference}.pdf`, content: pdf }],
      };
    },
  },
  {
    id: "bank-transfer-received",
    label: "Confirmation virement reçu",
    ref: paidBtRef,
    build: (pdf, model) => {
      const email = renderPaymentConfirmedEmail({
        reservationReference: model.reservationReference ?? "RES-PROOF-BT",
        invoiceReference: model.invoiceReference,
        spaceName: model.lines[0]?.label ?? "Espace",
        startAt: "20/07/2026 10:00:00",
        endAt: "20/07/2026 11:00:00",
        totalTTC: model.totals.ttc,
        paymentMethod: "bank_transfer",
        building: {
          name: "Cowork Prysme",
          addressFull: "Lyon",
        },
      });
      return {
        subject: `[PROOF Phase2] ${email.subject}`,
        html: email.html,
        attachments: [{ filename: `${model.invoiceReference}.pdf`, content: pdf }],
      };
    },
  },
];

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
  const { pdf, model, path } = await gen(c.ref);
  const mail = c.build(pdf, model);
  const info = await transporter.sendMail({
    from,
    to,
    subject: mail.subject,
    html: `${mail.html}<p style="margin-top:24px;font-size:12px;color:#666;">PROOF id=<code>${c.id}</code> — ${c.label}<br>PDF: ${path} (${pdf.length} bytes), paymentStatus=${model.paymentStatus}</p>`,
    attachments: mail.attachments,
  });
  summary.push({
    id: c.id,
    label: c.label,
    ref: c.ref,
    paymentStatus: model.paymentStatus,
    pdfBytes: pdf.length,
    filename: mail.attachments[0].filename,
    messageId: info.messageId,
    response: info.response,
    accepted: info.accepted,
  });
  console.log("SENT", summary.at(-1));
}

await pdfService.onModuleDestroy();
writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
console.log("Wrote", join(OUT, "summary.json"));
