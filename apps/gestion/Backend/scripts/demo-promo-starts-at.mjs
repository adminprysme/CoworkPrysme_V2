/**
 * Démo — date de début programmée (module Codes promo)
 * Usage: node scripts/demo-promo-starts-at.mjs
 */
import { createHash, randomBytes } from "node:crypto";

import {
  assertDiscountCodeApplicable,
  computeDiscountCodeDisplayStatus,
  DISCOUNT_CODE_INVALID_MESSAGE,
} from "@coworkprysme/shared";
import { connectMongo, getStaffProfileModel, getStaffSessionModel } from "@coworkprysme/db";

const API = "http://127.0.0.1:8003";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-local-session-secret-32chars-min!!";
const CODE_PREFIX = `DEMO_START_${Date.now().toString(36).toUpperCase()}`;

function hashToken(token) {
  return createHash("sha256").update(`${token}:${SESSION_SECRET}`).digest("hex");
}

async function createSessionForProfile(profile) {
  const token = randomBytes(32).toString("hex");
  const StaffSession = await getStaffSessionModel();
  await StaffSession.create({
    sessionTokenHash: hashToken(token),
    staffProfileId: profile._id,
    prysmAppUserId: profile.prysmAppUserId,
    authSource: "local",
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
  });
  return token;
}

async function api(path, { method = "GET", body, token } = {}) {
  const headers = { Cookie: `gestion_sid=${token}` };
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

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`  ✓ ${label} → ${expected}`);
}

await connectMongo();
const StaffProfile = await getStaffProfileModel();
const adminProfile = await StaffProfile.findOne({ email: "paul.thomas@local.coworkprysme.dev" }).exec();
if (!adminProfile) {
  throw new Error("Admin profile not found");
}

const adminToken = await createSessionForProfile(adminProfile);
const now = new Date();
const startsAtFuture = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
const startsAtPast = new Date(now.getTime() - 24 * 60 * 60 * 1000);

console.log("=== Scénario 1 — Créer un code programmé (startsAt futur) ===");
const createScheduled = await api("/discount-codes", {
  method: "POST",
  token: adminToken,
  body: {
    kind: "promo",
    code: `${CODE_PREFIX}_SCHED`,
    discountType: "percentage",
    valuePercent: 15,
    perimeter: { appliesTo: "order" },
    stackable: false,
    startsAt: startsAtFuture.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: "active",
  },
});
assertStatus("Create scheduled promo code", createScheduled, 201);
assertEqual("displayStatus after create", createScheduled.json.displayStatus, "scheduled");
assertEqual("startsAt persisted", Boolean(createScheduled.json.startsAt), true);
const scheduledId = createScheduled.json.id;

console.log("\n=== Scénario 2 — Recharger depuis l'API (persistance) ===");
const reloadScheduled = await api(`/discount-codes/${scheduledId}`, { token: adminToken });
assertStatus("Reload scheduled promo code", reloadScheduled, 200);
assertEqual("displayStatus after reload", reloadScheduled.json.displayStatus, "scheduled");

console.log("\n=== Scénario 3 — Validation applicabilité (code programmé rejeté) ===");
try {
  assertDiscountCodeApplicable(
    {
      status: "active",
      startsAt: startsAtFuture,
      expiresAt,
      usedCount: 0,
    },
    now,
  );
  throw new Error("Expected scheduled code to be rejected");
} catch (error) {
  assertEqual("applicability rejection message", error.message, DISCOUNT_CODE_INVALID_MESSAGE);
}

console.log("\n=== Scénario 4 — Basculer startsAt dans le passé → Actif automatique ===");
const activate = await api(`/discount-codes/${scheduledId}`, {
  method: "PATCH",
  token: adminToken,
  body: {
    startsAt: startsAtPast.toISOString(),
  },
});
assertStatus("Patch startsAt to past", activate, 200);
assertEqual("displayStatus after activation", activate.json.displayStatus, "active");

console.log("\n=== Scénario 5 — Non-régression sans startsAt ===");
const createImmediate = await api("/discount-codes", {
  method: "POST",
  token: adminToken,
  body: {
    kind: "promo",
    code: `${CODE_PREFIX}_NOW`,
    discountType: "percentage",
    valuePercent: 5,
    perimeter: { appliesTo: "order" },
    stackable: false,
    expiresAt: expiresAt.toISOString(),
    status: "active",
  },
});
assertStatus("Create immediate promo code", createImmediate, 201);
assertEqual("displayStatus without startsAt", createImmediate.json.displayStatus, "active");
assertEqual("shared compute without startsAt", computeDiscountCodeDisplayStatus({
  status: "active",
  expiresAt,
  usedCount: 0,
}, now), "active");

console.log("\n=== Démo terminée — codes promo programmés OK ===");
