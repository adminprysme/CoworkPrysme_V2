#!/usr/bin/env node
/**
 * Preview (+ optional send) of booking confirmation emails for two buildings.
 * Usage:
 *   cd apps/vitrine/Backend && set -a && . ./.env && set +a && node scripts/preview-booking-access-email.mjs
 *   EMAIL_TO=you@example.com node scripts/preview-booking-access-email.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import nodemailer from "nodemailer";

import {
  buildingToEmailAccess,
  renderBookingConfirmationEmail,
} from "../dist/mail/templates/booking-emails.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../../../../docs/screenshots-vitrine-espaces");

const common = {
  reservationReference: "RES-DEMO-ACCESS",
  invoiceReference: "PF-DEMO-ACCESS",
  startAt: "25/07/2026 10:00:00",
  endAt: "25/07/2026 12:00:00",
  totalTTC: 4800,
  lines: [{ label: "Espace démo", qty: 1, totalTTC: 4800 }],
  vatBreakdown: [{ rate: 20, baseHT: 4000, vat: 800 }],
  siteUrl: process.env.PUBLIC_SITE_URL ?? "http://localhost:3001",
};

const gerland = renderBookingConfirmationEmail({
  ...common,
  spaceName: "FOCUS",
  lines: [{ label: "FOCUS", qty: 1, totalTTC: 4800 }],
  building: buildingToEmailAccess({
    name: "Cowork GERLAND",
    email: "accueil-technopark-a1@coworkprysme.eu",
    phone: "07 83 82 35 29",
    address: {
      street: "39 Rue Saint-Jean de Dieu",
      zip: "69007",
      city: "Lyon",
      accessInfo:
        "Entrée principale le long de la grille devant la rue — suivre l'allée. Sonner à CoworkPrysme.",
    },
    concierge: {
      url: "https://espaceclient.maconciergerie.eu/login?c=229&e=COR001",
      accessCode: "229",
    },
  }),
});

const partDieu = renderBookingConfirmationEmail({
  ...common,
  spaceName: "Bureau Horizon",
  lines: [{ label: "Bureau Horizon", qty: 1, totalTTC: 4800 }],
  building: buildingToEmailAccess({
    name: "Cowork PART-DIEU (fictif)",
    email: "accueil-partdieu@coworkprysme.eu",
    phone: "04 00 00 00 00",
    accessCode: "PD-7788",
    address: {
      street: "12 rue fictive Part-Dieu",
      zip: "69003",
      city: "Lyon",
      accessInfo: "Hall B, 3e étage — badge visiteur à la réception centrale.",
    },
    concierge: {
      url: "https://concierge.example.com/partdieu",
      accessCode: "PDX-42",
    },
  }),
});

await mkdir(outDir, { recursive: true });
const gerlandPath = join(outDir, "email-booking-access-gerland.html");
const partDieuPath = join(outDir, "email-booking-access-partdieu.html");
await writeFile(gerlandPath, gerland.html, "utf8");
await writeFile(partDieuPath, partDieu.html, "utf8");

console.log("Wrote", gerlandPath);
console.log("Wrote", partDieuPath);
console.log("\n--- Plan d'accès GERLAND ---");
console.log(gerland.html.match(/Plan d'accès[\s\S]*?<\/ul>/)?.[0]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
console.log("\n--- Plan d'accès PART-DIEU (fictif) ---");
console.log(partDieu.html.match(/Plan d'accès[\s\S]*?<\/ul>/)?.[0]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

const emailTo = process.env.EMAIL_TO?.trim();
if (emailTo && process.env.SMTP_HOST) {
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
  await transporter.sendMail({
    from,
    to: emailTo,
    subject: `[DEMO] ${partDieu.subject} — bâtiment PART-DIEU`,
    html: partDieu.html,
  });
  console.log(`\nSent PART-DIEU demo email to ${emailTo}`);
} else {
  console.log("\nSkip SMTP send (set EMAIL_TO + SMTP_* to send).");
}
