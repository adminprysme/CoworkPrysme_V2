#!/usr/bin/env node
/**
 * Demo: card booking — emails deferred until Stripe payment succeeds;
 * abandoned awaiting_payment expires and cancels the PaymentIntent.
 *
 * Prerequisites: vitrine-api on :8002, stripe listen --forward-to localhost:8002/stripe/webhook
 *
 * Usage:
 *   cd apps/vitrine/Backend && set -a && source .env && set +a && node scripts/demo-card-payment-defer-emails.mjs
 */
import { randomBytes } from "node:crypto";

import {
  connectMongo,
  expireAwaitingPaymentReservations,
  getReservationModel,
} from "@coworkprysme/db";
import Stripe from "stripe";

const API = process.env.VITRINE_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8002";
const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  throw new Error("STRIPE_SECRET_KEY required");
}
const stripe = new Stripe(stripeSecret);

async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${API}${path}`, { method, headers, body: payload });
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

function pickFutureSlot(extraDays = 0) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 14 + extraDays + Math.floor(Math.random() * 20));
  start.setUTCMinutes(0, 0, 0);
  // Prefer mid-morning Paris weekday hours in UTC-ish window
  const hour = 8 + Math.floor(Math.random() * 4);
  start.setUTCHours(hour, 0, 0, 0);
  while (start.getUTCDay() === 0 || start.getUTCDay() === 6) {
    start.setUTCDate(start.getUTCDate() + 1);
  }
  const end = new Date(start);
  end.setUTCHours(hour + 1, 0, 0, 0);
  return { start, end };
}

console.log("=== Demo card: deferred emails + awaiting_payment + expiry ===\n");

const health = await api("/health");
assert("vitrine-api healthy", health.status === 200, health.text);

const spaces = await api("/booking/spaces?spaceType=meeting_room&partySize=2");
assert("spaces available", spaces.status === 200 && spaces.json?.spaces?.length > 0);
const space = spaces.json.spaces[0];

const { start, end } = pickFutureSlot(0);
const sessionId = randomBytes(16).toString("hex");
const email = `card-demo-${Date.now()}@example.com`;

console.log(`\n1) Lock + confirm card for ${space.name} (${start.toISOString()})`);
const lock = await api("/booking/lock", {
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

const confirm = await api("/booking/confirm", {
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
    identity: { firstName: "Demo", lastName: "Carte", phone: "0611223344" },
    privacyPolicyAccepted: true,
    marketingCommunicationsAccepted: false,
    cgvAccepted: true,
    withdrawalAcknowledged: true,
    paymentMethod: "card",
  },
});
assert("confirm card → 200/201", confirm.status === 201 || confirm.status === 200, confirm.text);
assert(
  "reservationStatus awaiting_payment",
  confirm.json.reservationStatus === "awaiting_payment",
  JSON.stringify(confirm.json),
);
const { reservationReference, invoiceReference } = confirm.json;
console.log(`     → ${reservationReference} / ${invoiceReference}`);

await connectMongo();
const Reservation = await getReservationModel();
const beforePay = await Reservation.findOne({ reference: reservationReference }).lean().exec();
assert("DB status awaiting_payment", beforePay?.status === "awaiting_payment");
assert("awaitingPaymentExpiresAt set", Boolean(beforePay?.awaitingPaymentExpiresAt));

console.log("\n2) No confirmation emails at create (Nest: emails deferred; unit tests cover recipients)");

console.log("\n3) Create PaymentIntent + confirm with test PM pm_card_visa (4242)…");
const intent = await api("/booking/payments/intent", {
  method: "POST",
  body: { reservationReference, invoiceReference },
});
assert("payment intent created", intent.status === 201 || intent.status === 200, intent.text);
const paymentIntentId = intent.json.paymentIntentId;

const confirmedPi = await stripe.paymentIntents.confirm(paymentIntentId, {
  payment_method: "pm_card_visa",
  return_url: "http://127.0.0.1:3001/reservation",
});
assert("PI succeeded", confirmedPi.status === "succeeded", confirmedPi.status);

console.log("\n4) POST signed payment_intent.succeeded webhook → Nest applies + emails…");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET required");
const eventPayload = JSON.stringify({
  id: `evt_demo_${Date.now()}`,
  object: "event",
  api_version: "2024-11-20.acacia",
  created: Math.floor(Date.now() / 1000),
  type: "payment_intent.succeeded",
  data: { object: confirmedPi },
  livemode: false,
  pending_webhooks: 0,
  request: { id: null, idempotency_key: null },
});
const signature = stripe.webhooks.generateTestHeaderString({
  payload: eventPayload,
  secret: webhookSecret,
});
const webhookRes = await fetch(`${API}/stripe/webhook`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "stripe-signature": signature,
  },
  body: eventPayload,
});
const webhookText = await webhookRes.text();
assert("webhook accepted", webhookRes.status === 200 || webhookRes.status === 201, webhookText);

let paid = false;
for (let i = 0; i < 15; i++) {
  const status = await api(
    `/booking/payments/status?reservationReference=${encodeURIComponent(reservationReference)}&invoiceReference=${encodeURIComponent(invoiceReference)}`,
  );
  if (
    status.status === 200 &&
    status.json?.paymentState === "paid" &&
    status.json?.reservationStatus === "confirmed"
  ) {
    paid = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 500));
}
assert("webhook applied payment + confirmed reservation", paid, "status not updated after webhook");

const afterPay = await Reservation.findOne({ reference: reservationReference }).lean().exec();
assert("DB status confirmed after payment", afterPay?.status === "confirmed", afterPay?.status);
console.log("     → check Nest logs for client + staff emails sent after webhook");

console.log("\n5) Abandon: second card hold → force 45min expiry → cancel Stripe PI");
const { start: start2, end: end2 } = pickFutureSlot(10);
const session2 = randomBytes(16).toString("hex");
const email2 = `card-expire-${Date.now()}@example.com`;

const lock2 = await api("/booking/lock", {
  method: "POST",
  body: {
    spaceId: space.spaceId,
    startAt: start2.toISOString(),
    endAt: end2.toISOString(),
    sessionId: session2,
    partySize: 2,
  },
});
assert("lock2 acquired", lock2.status === 201 || lock2.status === 200, lock2.text);

const confirm2 = await api("/booking/confirm", {
  method: "POST",
  body: {
    lockId: lock2.json.lockId,
    sessionId: session2,
    spaceId: space.spaceId,
    startAt: start2.toISOString(),
    endAt: end2.toISOString(),
    durationClass: "hourly",
    partySize: 2,
    services: [],
    accountMode: "new",
    email: email2,
    password: "DemoPass1!",
    identity: { firstName: "Expire", lastName: "Demo", phone: "0611223344" },
    privacyPolicyAccepted: true,
    marketingCommunicationsAccepted: false,
    cgvAccepted: true,
    withdrawalAcknowledged: true,
    paymentMethod: "card",
  },
});
assert("confirm2 card awaiting", confirm2.json?.reservationStatus === "awaiting_payment", confirm2.text);

const intent2 = await api("/booking/payments/intent", {
  method: "POST",
  body: {
    reservationReference: confirm2.json.reservationReference,
    invoiceReference: confirm2.json.invoiceReference,
  },
});
assert("intent2 created", intent2.status === 200 || intent2.status === 201, intent2.text);
const pi2 = intent2.json.paymentIntentId;

await Reservation.updateOne(
  { reference: confirm2.json.reservationReference },
  { $set: { awaitingPaymentExpiresAt: new Date(Date.now() - 1000) } },
).exec();

const expired = await expireAwaitingPaymentReservations(new Date());
assert(
  "reservation expired locally (cancelled)",
  expired.expired.some((e) => e.reference === confirm2.json.reservationReference),
  JSON.stringify(expired),
);

const row = expired.expired.find((e) => e.reference === confirm2.json.reservationReference);
assert("expiry returned stripePaymentIntentId", row?.stripePaymentIntentId === pi2, JSON.stringify(row));

const cancelledPi = await stripe.paymentIntents.cancel(pi2);
assert("PaymentIntent cancelled on Stripe", cancelledPi.status === "canceled", cancelledPi.status);

const afterExpire = await Reservation.findOne({
  reference: confirm2.json.reservationReference,
})
  .lean()
  .exec();
assert("reservation cancelled after expiry", afterExpire?.status === "cancelled", afterExpire?.status);

const session3 = randomBytes(16).toString("hex");
const lock3 = await api("/booking/lock", {
  method: "POST",
  body: {
    spaceId: space.spaceId,
    startAt: start2.toISOString(),
    endAt: end2.toISOString(),
    sessionId: session3,
    partySize: 2,
  },
});
assert("slot freed — lock succeeds again", lock3.status === 201 || lock3.status === 200, lock3.text);
await api(`/booking/lock/${lock3.json.lockId}?sessionId=${session3}`, { method: "DELETE" });

console.log("\n=== Demo OK ===");
console.log(`Paid: ${reservationReference} (confirmed after webhook; emails at that moment)`);
console.log(`Expired: ${confirm2.json.reservationReference} (cancelled; PI ${pi2} canceled; no emails)`);
process.exit(0);
