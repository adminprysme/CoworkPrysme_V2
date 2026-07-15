#!/usr/bin/env node
/**
 * Démo Phase 2 — services, questions, prix et codes promo (vitrine-api)
 * Usage: cd apps/vitrine/Backend && set -a && source .env && set +a && node scripts/demo-booking-phase2.mjs
 */
import { randomBytes } from "node:crypto";

import { connectMongo, getDiscountCodeModel } from "@coworkprysme/db";
import {
  DISCOUNT_CODE_INVALID_MESSAGE,
  DISCOUNT_CODE_PREFERENTIAL_PENDING_MESSAGE,
} from "@coworkprysme/shared";

const API = process.env.VITRINE_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8002";

async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${API}${path}`, { method, headers, body: payload });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { status: response.status, json, text };
}

function assertStatus(label, result, expected) {
  if (result.status !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${result.status}: ${result.text}`);
  }
  console.log(`  ✓ ${label} → ${expected}`);
}

function assertMessage(label, result, expectedMessage) {
  const message =
    typeof result.json === "object" && result.json !== null && "message" in result.json
      ? result.json.message
      : null;
  if (message !== expectedMessage) {
    throw new Error(`${label}: expected message "${expectedMessage}", got "${message}"`);
  }
  console.log(`  ✓ ${label} → "${expectedMessage}"`);
}

console.log("=== Phase 2 — catalogue services ===");
const spaces = await api(
  "/booking/spaces?spaceType=meeting_room&partySize=2",
);
assertStatus("GET /booking/spaces", spaces, 200);
const space = spaces.json?.spaces?.[0];
if (!space) {
  throw new Error("No meeting room found for demo");
}

const services = await api(`/booking/services?buildingId=${space.buildingId}`);
assertStatus("GET /booking/services", services, 200);
console.log(`  ✓ ${services.json.services.length} service(s) for building ${space.buildingName}`);

const offsetDays = 2 + (Date.now() % 5);
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + offsetDays);
tomorrow.setHours(9, 0, 0, 0);
const end = new Date(tomorrow);
end.setHours(18, 0, 0, 0);

console.log("\n=== Phase 2 — lock + prix ===");
const sessionId = randomBytes(16).toString("hex");
const lock = await api("/booking/lock", {
  method: "POST",
  body: {
    spaceId: space.spaceId,
    startAt: tomorrow.toISOString(),
    endAt: end.toISOString(),
    sessionId,
    partySize: 2,
  },
});
assertStatus("POST /booking/lock", lock, 201);

const basePriceBody = {
  spaceId: space.spaceId,
  startAt: lock.json.startAt,
  endAt: lock.json.endAt,
  durationClass: "daily",
  services: [],
};

const price = await api("/booking/price", { method: "POST", body: basePriceBody });
assertStatus("POST /booking/price (sans promo)", price, 201);
console.log(`  ✓ total TTC ${(price.json.totalTTC / 100).toFixed(2)} €`);

if (services.json.services.length > 0) {
  const service = services.json.services[0];
  const withService = await api("/booking/price", {
    method: "POST",
    body: {
      ...basePriceBody,
      services: [{ serviceId: service.id, qty: 1 }],
    },
  });
  assertStatus("POST /booking/price (avec service)", withService, 201);
  console.log(`  ✓ service « ${service.label} » ajouté`);
}

console.log("\n=== Phase 2 — codes promo ===");
await connectMongo();
const DiscountCode = await getDiscountCodeModel();
const preferentialDoc = await DiscountCode.findOne({ kind: "preferential" }).lean().exec();

if (preferentialDoc) {
  const preferential = await api("/booking/price", {
    method: "POST",
    body: { ...basePriceBody, discountCode: preferentialDoc.code },
  });
  assertStatus("Code preferential", preferential, 400);
  assertMessage("Code preferential", preferential, DISCOUNT_CODE_PREFERENTIAL_PENDING_MESSAGE);
} else {
  console.log("  ↷ Aucun code preferential en base — scénario ignoré");
}

const scheduledDoc = await DiscountCode.findOne({
  kind: "promo",
  startsAt: { $gt: new Date() },
  status: "active",
}).lean().exec();

if (scheduledDoc) {
  const scheduled = await api("/booking/price", {
    method: "POST",
    body: { ...basePriceBody, discountCode: scheduledDoc.code },
  });
  assertStatus("Code programmé", scheduled, 400);
  assertMessage("Code programmé", scheduled, DISCOUNT_CODE_INVALID_MESSAGE);
} else {
  console.log("  ↷ Aucun code programmé actif — scénario ignoré");
}

const invalid = await api("/booking/price", {
  method: "POST",
  body: { ...basePriceBody, discountCode: "NOT_A_REAL_CODE_123" },
});
assertStatus("Code inconnu", invalid, 400);
assertMessage("Code inconnu", invalid, DISCOUNT_CODE_INVALID_MESSAGE);

const promoAttempt = await api("/booking/price", {
  method: "POST",
  body: { ...basePriceBody, discountCode: "WELCOME20" },
});
if (promoAttempt.status === 201) {
  console.log(`  ✓ promo WELCOME20 appliquée, remise ${(promoAttempt.json.discountTotal / 100).toFixed(2)} €`);
} else {
  console.log("  ↷ WELCOME20 absent ou invalide — scénario promo ignoré");
}

console.log("\n=== Démo Phase 2 terminée ===");
