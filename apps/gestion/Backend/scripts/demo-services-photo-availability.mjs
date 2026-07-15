/**
 * Démo — photo service + disponibilité (module Services)
 * Usage: node scripts/demo-services-photo-availability.mjs
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { connectMongo, getBuildingModel, getStaffProfileModel, getStaffSessionModel } from "@coworkprysme/db";

const API = "http://127.0.0.1:8003";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-local-session-secret-32chars-min!!";
const DEMO_LABEL = "DEMO photo + disponibilité";
const MANAGER_EMAIL = "demo-services-scoped@local.coworkprysme.dev";

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

async function api(path, { method = "GET", body, token, formData } = {}) {
  const headers = { Cookie: `gestion_sid=${token}` };
  let payload = body;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
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

async function ensureScopedManager(buildingA, buildingB) {
  const StaffProfile = await getStaffProfileModel();
  let profile = await StaffProfile.findOne({ email: MANAGER_EMAIL }).exec();
  if (!profile) {
    profile = await StaffProfile.create({
      prysmAppUserId: "local:demo-services-scoped",
      displayName: "Demo Services Scoped",
      email: MANAGER_EMAIL,
      role: "manager",
      permissions: {
        planning: false,
        billing: false,
        clients: false,
        stats: false,
        spaces: false,
        services: true,
        promo: false,
      },
      scope: { buildingIds: [buildingA], spaceTypes: [] },
      status: "active",
    });
  } else {
    profile.role = "manager";
    profile.permissions.services = true;
    profile.scope.buildingIds = [buildingA];
    await profile.save();
  }
  return profile;
}

const mongoose = await connectMongo();
const StaffProfile = await getStaffProfileModel();
const adminProfile = await StaffProfile.findOne({ email: "paul.thomas@local.coworkprysme.dev" }).exec();
if (!adminProfile) {
  throw new Error("Admin profile not found");
}

const Building = await getBuildingModel();
const buildings = await Building.find({ status: "active" }).limit(2).lean().exec();
if (buildings.length < 2) {
  throw new Error("Need at least 2 active buildings for demo");
}
const [buildingA, buildingB] = buildings.map((doc) => doc._id.toString());

const adminToken = await createSessionForProfile(adminProfile);
const managerProfile = await ensureScopedManager(buildingA, buildingB);
const managerToken = await createSessionForProfile(managerProfile);

console.log("=== Scénario 1 — Admin crée service global + photo ===");
const createGlobal = await api(
  "/services",
  {
    method: "POST",
    token: adminToken,
    body: {
      label: `${DEMO_LABEL} global`,
      priceEurosHT: 25,
      vatRate: 20,
      promoEligible: false,
      status: "active",
      customQuestions: [],
      isGlobal: true,
      buildingIds: [],
    },
  },
);
assertStatus("Admin create global", createGlobal, 201);
const globalServiceId = createGlobal.json.id;

const pngPath = resolve(process.cwd(), "../../docs/screenshots-vitrine-espaces");
let photoBuffer;
try {
  const files = readdirSync(pngPath).filter((name) => /\.(png|jpe?g|webp)$/i.test(name));
  if (files.length === 0) throw new Error("no image");
  photoBuffer = readFileSync(resolve(pngPath, files[0]));
} catch {
  photoBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

const formData = new FormData();
formData.append("file", new Blob([photoBuffer], { type: "image/png" }), "demo.png");
const uploadPhoto = await api(`/services/${globalServiceId}/photos`, {
  method: "POST",
  token: adminToken,
  formData,
});
assertStatus("Admin upload photo", uploadPhoto, 201);
console.log(`  photo: ${uploadPhoto.json.photo?.url ?? "(missing)"}`);

console.log("\n=== Scénario 2 — Gestionnaire scoped : OK sur bâtiment A, 403 sur B ===");
const createScopedOk = await api(
  "/services",
  {
    method: "POST",
    token: managerToken,
    body: {
      label: `${DEMO_LABEL} scoped A`,
      priceEurosHT: 12,
      vatRate: 20,
      promoEligible: false,
      status: "active",
      customQuestions: [],
      isGlobal: false,
      buildingIds: [buildingA],
    },
  },
);
assertStatus("Manager create scoped building A", createScopedOk, 201);

const createScopedForbidden = await api(
  "/services",
  {
    method: "POST",
    token: managerToken,
    body: {
      label: `${DEMO_LABEL} scoped B`,
      priceEurosHT: 12,
      vatRate: 20,
      promoEligible: false,
      status: "active",
      customQuestions: [],
      isGlobal: false,
      buildingIds: [buildingB],
    },
  },
);
assertStatus("Manager create scoped building B (forbidden)", createScopedForbidden, 403);

console.log("\n=== Scénario 3 — Gestionnaire sur global : prix OK, label 403 ===");
const priceUpdate = await api(`/services/${globalServiceId}`, {
  method: "PATCH",
  token: managerToken,
  body: { priceEurosHT: 29.99 },
});
assertStatus("Manager price update on global", priceUpdate, 200);

const labelForbidden = await api(`/services/${globalServiceId}`, {
  method: "PATCH",
  token: managerToken,
  body: { label: "Tentative renommage" },
});
assertStatus("Manager label update on global (forbidden)", labelForbidden, 403);

console.log("\n=== Scénario 4 — Suppression photo + persistance ===");
const deletePhoto = await api(`/services/${globalServiceId}/photos`, {
  method: "DELETE",
  token: adminToken,
});
assertStatus("Admin delete photo", deletePhoto, 200);

const refetch = await api(`/services/${globalServiceId}`, { token: adminToken });
assertStatus("Refetch service after photo delete", refetch, 200);
if (refetch.json.photo) {
  throw new Error("Photo still present after delete");
}
console.log("  ✓ photo absente après suppression");

console.log("\n=== Scénario 5 — Liste gestionnaire (global ∪ scope) ===");
const managerList = await api("/services?status=all", { token: managerToken });
assertStatus("Manager list services", managerList, 200);
const ids = new Set(managerList.json.services.map((service) => service.id));
if (!ids.has(globalServiceId)) {
  throw new Error("Global service missing from manager list");
}
if (!ids.has(createScopedOk.json.id)) {
  throw new Error("Scoped service A missing from manager list");
}
console.log(`  ✓ ${managerList.json.services.length} services visibles (global + périmètre)`);

console.log("\n=== Nettoyage (admin delete demo services) ===");
for (const id of [globalServiceId, createScopedOk.json.id]) {
  const del = await api(`/services/${id}`, { method: "DELETE", token: adminToken });
  assertStatus(`Delete ${id}`, del, 200);
}

console.log("\nDémo terminée — 5 scénarios OK");
await mongoose.disconnect();
