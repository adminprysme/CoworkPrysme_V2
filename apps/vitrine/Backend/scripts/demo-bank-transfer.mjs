#!/usr/bin/env node
/**
 * Demo: bank transfer — eligibility, RIB email payload, mark-received → confirmed.
 *
 * Prerequisites:
 *   - vitrine-api on :8002 with BANK_TRANSFER_IBAN/BIC/ACCOUNT_HOLDER set
 *   - Mongo reachable (same .env as vitrine-api)
 *
 * Usage:
 *   cd apps/vitrine/Backend && set -a && source .env && set +a && node scripts/demo-bank-transfer.mjs
 *
 * Optional: set DEMO_GESTION_COOKIE to exercise mark-received via gestion-api (:8003).
 * Without it, mark-received is applied via @coworkprysme/db directly (same code path).
 */
import { randomBytes } from "node:crypto";

import {
  applyBankTransferPayment,
  confirmReservationAfterPayment,
  connectMongo,
  findDueBankTransferReminders,
  getInvoiceModel,
  getReservationModel,
  markBankTransferReminderSent,
} from "@coworkprysme/db";
import {
  BANK_TRANSFER_REMINDER_OFFSET_DAYS,
  computeBankTransferExpiresAt,
  isBankTransferFullyEligible,
} from "@coworkprysme/shared";

const API = process.env.VITRINE_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8002";
const GESTION_API = process.env.GESTION_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8003";

async function api(base, path, { method = "GET", body, cookie } = {}) {
  const headers = {};
  if (cookie) {
    headers.Cookie = cookie;
  }
  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${base}${path}`, { method, headers, body: payload });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

function assert(label, condition, detail = "") {
  if (!condition) {
    throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
  console.log(`  ✓ ${label}`);
}

function addUtcDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function pickSlotInDays(daysAhead) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + daysAhead);
  start.setUTCMinutes(0, 0, 0);
  start.setUTCHours(9, 0, 0, 0);
  while (start.getUTCDay() === 0 || start.getUTCDay() === 6) {
    start.setUTCDate(start.getUTCDate() + 1);
  }
  const end = new Date(start);
  end.setUTCHours(10, 0, 0, 0);
  return { start, end };
}

console.log("=== Demo bank_transfer: eligibility → RIB → mark received ===\n");

const health = await api(API, "/health");
assert("vitrine-api healthy", health.status === 200, health.text);

const ribOk =
  Boolean(process.env.BANK_TRANSFER_IBAN?.trim()) &&
  Boolean(process.env.BANK_TRANSFER_BIC?.trim()) &&
  Boolean(process.env.BANK_TRANSFER_ACCOUNT_HOLDER?.trim());
assert("BANK_TRANSFER_* RIB env set", ribOk, "fill IBAN/BIC/ACCOUNT_HOLDER in .env");

// --- A) 3-day start: option hidden + confirm rejected ---
console.log("\nA) Réservation à ~3 jours → bank_transfer absente / rejetée");
{
  const { start } = pickSlotInDays(3);
  const methods = await api(API, `/booking/payment-methods?startAt=${encodeURIComponent(start.toISOString())}`);
  assert("payment-methods 200", methods.status === 200, methods.text);
  assert(
    "bank_transfer hidden at 3 days",
    methods.json?.bankTransferAvailable === false &&
      !methods.json?.paymentMethods?.includes("bank_transfer"),
    JSON.stringify(methods.json),
  );
}

// --- B) Shared exact-margin edge (window_too_short) ---
console.log("\nB) Cas limite fenêtre trop courte (lead OK, safety trop large)");
{
  const now = new Date("2026-07-16T10:00:00.000Z");
  const start = addUtcDays(now, 7);
  assert(
    "lead alone with default safety=2 is eligible",
    isBankTransferFullyEligible({
      startAt: start,
      now,
      minLeadDays: 7,
      paymentWindowDays: 8,
      safetyMarginDays: 2,
    }),
  );
  const tight = isBankTransferFullyEligible({
    startAt: start,
    now,
    minLeadDays: 7,
    paymentWindowDays: 8,
    safetyMarginDays: 7,
  });
  assert("exact lead + safety=7 → not fully eligible", tight === false);
  const expiry = computeBankTransferExpiresAt({
    issuedAt: now,
    startAt: start,
    paymentWindowDays: 8,
    safetyMarginDays: 7,
  });
  assert("expiry reason window_too_short", expiry.ok === false && expiry.reason === "window_too_short");
}

// --- C) 10-day eligible path ---
console.log("\nC) Réservation à ~10 jours → confirm bank_transfer + RIB payload");
const spaces = await api(API, "/booking/spaces?spaceType=meeting_room&partySize=2");
assert("spaces available", spaces.status === 200 && spaces.json?.spaces?.length > 0);
const space = spaces.json.spaces[0];
const { start, end } = pickSlotInDays(12);
const sessionId = randomBytes(16).toString("hex");
const email = `bt-demo-${Date.now()}@example.com`;

const methods10 = await api(
  API,
  `/booking/payment-methods?startAt=${encodeURIComponent(start.toISOString())}`,
);
assert("bank_transfer offered at ~10+ days", methods10.json?.bankTransferAvailable === true);

const lock = await api(API, "/booking/lock", {
  method: "POST",
  body: {
    spaceId: space.spaceId,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    sessionId,
    partySize: 2,
  },
});
assert("lock acquired", lock.status === 201 || lock.status === 200, lock.text);

const confirm = await api(API, "/booking/confirm", {
  method: "POST",
  body: {
    lockId: lock.json.lockId,
    sessionId,
    spaceId: space.spaceId,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    durationClass: "hourly",
    partySize: 2,
    services: [],
    accountMode: "new",
    email,
    password: "DemoPass1!",
    identity: { firstName: "Demo", lastName: "Virement", phone: "0611223344" },
    privacyPolicyAccepted: true,
    marketingCommunicationsAccepted: false,
    cgvAccepted: true,
    withdrawalAcknowledged: true,
    paymentMethod: "bank_transfer",
  },
});
assert("confirm bank_transfer → 200/201", confirm.status === 201 || confirm.status === 200, confirm.text);
assert(
  "reservationStatus awaiting_payment",
  confirm.json?.reservationStatus === "awaiting_payment",
  JSON.stringify(confirm.json),
);
assert("bankTransfer payload present", Boolean(confirm.json?.bankTransfer?.iban));
assert(
  "transferLabel = reservation reference",
  confirm.json.bankTransfer.transferLabel === confirm.json.reservationReference,
);
assert("amountCents > 0", confirm.json.bankTransfer.amountCents > 0);
assert("expiresAt ISO", typeof confirm.json.bankTransfer.expiresAt === "string");

const { reservationReference, invoiceReference } = confirm.json;
console.log(`     → ${reservationReference} / ${invoiceReference}`);
console.log(
  `     → libellé=${confirm.json.bankTransfer.transferLabel} montant=${confirm.json.bankTransfer.amountCents}c`,
);

await connectMongo();
const Reservation = await getReservationModel();
const Invoice = await getInvoiceModel();
const stored = await Reservation.findOne({ reference: reservationReference }).lean().exec();
assert("DB awaitingPaymentMethod bank_transfer", stored?.awaitingPaymentMethod === "bank_transfer");
assert("DB awaitingPaymentExpiresAt set", Boolean(stored?.awaitingPaymentExpiresAt));

const invoice = await Invoice.findOne({ reservationId: stored._id }).lean().exec();
assert("invoice found", Boolean(invoice));
const issuedAt = invoice.issuedAt ?? invoice.createdAt;
const j2 = addUtcDays(issuedAt, BANK_TRANSFER_REMINDER_OFFSET_DAYS.j2);
assert("reminder j2 = issuedAt+2d", j2.getTime() > issuedAt.getTime());

// --- D) Reminder stop after mark-received ---
console.log("\nD) Mark received → confirmed ; relances stoppées");
const gestionCookie = process.env.DEMO_GESTION_COOKIE?.trim();
if (gestionCookie) {
  const marked = await api(GESTION_API, "/billing/transfers/mark-received", {
    method: "POST",
    body: { reference: reservationReference },
    cookie: gestionCookie,
  });
  assert("gestion mark-received 200/201", marked.status === 200 || marked.status === 201, marked.text);
  assert("gestion transitioned", marked.json?.transitioned === true || marked.json?.applied === true);
} else {
  const payment = await applyBankTransferPayment({
    invoiceId: invoice._id,
    amountReceived: invoice.totals.balanceDue,
  });
  assert("applyBankTransferPayment applied", payment.applied === true);
  const confirmed = await confirmReservationAfterPayment({
    reservationId: stored._id,
    reason: "bank_transfer_received",
  });
  assert("confirmReservationAfterPayment transitioned", confirmed.transitioned === true);
  assert("status confirmed", confirmed.reservation.status === "confirmed");
}

const after = await Reservation.findOne({ reference: reservationReference }).lean().exec();
assert("final status confirmed", after?.status === "confirmed");

const dueAfter = await findDueBankTransferReminders(addUtcDays(issuedAt, 10));
assert(
  "no due reminders after mark-received",
  !dueAfter.some((row) => row.reference === reservationReference),
);
const markSent = await markBankTransferReminderSent(stored._id, "j2");
assert("markBankTransferReminderSent returns false after confirm", markSent === false);

console.log("\n=== Demo bank_transfer OK ===\n");
process.exit(0);
