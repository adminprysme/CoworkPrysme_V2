#!/usr/bin/env node
/**
 * One-shot demo: client confirmation + staff notification via resolveBookingNotificationRecipients.
 * Does NOT create a reservation. Uses SMTP from .env.
 *
 * Usage:
 *   cd apps/vitrine/Backend && set -a && . ./.env && set +a && \
 *     FALLBACK_BOOKING_NOTIFICATION_EMAIL=you@example.com \
 *     DEMO_CLIENT_EMAIL=client@example.com \
 *     node scripts/demo-booking-notification-emails.mjs
 */
import nodemailer from "nodemailer";

import { resolveBookingNotificationRecipients } from "../dist/mail/resolve-booking-notification-recipients.js";
import {
  buildingToEmailAccess,
  renderBookingConfirmationEmail,
  renderStaffBookingNotificationEmail,
} from "../dist/mail/templates/booking-emails.js";

const BUILDING_CONTACT = "accueil-technopark-a1@coworkprysme.eu";
const clientEmail = (process.env.DEMO_CLIENT_EMAIL || "client-demo@example.com").trim().toLowerCase();

const building = buildingToEmailAccess({
  name: "Cowork GERLAND",
  email: BUILDING_CONTACT,
  phone: "07 83 82 35 29",
  address: {
    street: "39 Rue Saint-Jean de Dieu",
    zip: "69007",
    city: "Lyon",
    accessInfo: "Sonner à CoworkPrysme.",
  },
});

const clientMail = renderBookingConfirmationEmail({
  reservationReference: "RES-DEMO-NOTIFY",
  invoiceReference: "PF-DEMO-NOTIFY",
  spaceName: "FOCUS",
  startAt: "16/07/2026 14:00:00",
  endAt: "16/07/2026 16:00:00",
  totalTTC: 4800,
  lines: [{ label: "FOCUS", qty: 1, totalTTC: 4800 }],
  vatBreakdown: [{ rate: 20, baseHT: 4000, vat: 800 }],
  building,
});

const staffRecipients = await resolveBookingNotificationRecipients("6a450754b9355f502497c9ce");
console.log("resolveBookingNotificationRecipients →", staffRecipients);

if (staffRecipients.length === 0) {
  console.warn(
    "aucun destinataire de notification configuré pour ce bâtiment (set FALLBACK_BOOKING_NOTIFICATION_EMAIL)",
  );
}

if (staffRecipients.includes(BUILDING_CONTACT)) {
  throw new Error("REFUSÉ: building.contactEmail ne doit jamais être destinataire");
}
if (staffRecipients.includes(clientEmail) === false && staffRecipients.length > 0) {
  // ok — staff list is independent of client
}

const staffMail = renderStaffBookingNotificationEmail({
  reservationReference: "RES-DEMO-NOTIFY",
  invoiceReference: "PF-DEMO-NOTIFY",
  spaceName: "FOCUS",
  buildingName: building.name,
  startAt: "16/07/2026 14:00:00",
  endAt: "16/07/2026 16:00:00",
  totalTTC: 4800,
  clientEmail,
  clientName: "Demo Client",
  paymentMethod: "bank_transfer",
});

if (!process.env.SMTP_HOST) {
  console.log("SMTP_HOST missing — dry-run only");
  console.log("Would send client to:", clientEmail, clientMail.subject);
  for (const to of staffRecipients) {
    console.log("Would send staff to:", to, staffMail.subject);
  }
  process.exit(0);
}

const isReservedDemoClient =
  clientEmail.endsWith(".example.com") || clientEmail.endsWith("@example.com");

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

if (isReservedDemoClient) {
  console.log("Skip CLIENT SMTP send (DEMO_CLIENT_EMAIL is RFC-reserved). Subject:", clientMail.subject);
} else {
  await transporter.sendMail({
    from,
    to: clientEmail,
    subject: `[DEMO] ${clientMail.subject}`,
    html: clientMail.html,
  });
  console.log("Sent CLIENT confirmation to:", clientEmail);
}

for (const to of staffRecipients) {
  if (to === BUILDING_CONTACT) {
    throw new Error("REFUSÉ: tentative d'envoi au contact bâtiment");
  }
  await transporter.sendMail({
    from,
    to,
    subject: `[DEMO] ${staffMail.subject}`,
    html: staffMail.html,
  });
  console.log("Sent STAFF notification to:", to);
}

console.log("Done.");
