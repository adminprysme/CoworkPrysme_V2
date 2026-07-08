/**
 * Diagnostic: photo storageKey chain on re-save without changes.
 * Usage: cd apps/gestion/Backend && set -a && source .env && node scripts/diagnose-photo-resave.mjs
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { connectMongo, getBuildingModel, getStaffProfileModel, getStaffSessionModel } from "@coworkprysme/db";
import { resolveStorageKeyAbsolutePath } from "@coworkprysme/shared/server";

const API = "http://127.0.0.1:8003";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-local-session-secret-32chars-min!!";
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? resolve(process.cwd(), "uploads");

function hashToken(token) {
  return createHash("sha256").update(`${token}:${SESSION_SECRET}`).digest("hex");
}

async function createSessionToken() {
  const token = randomBytes(32).toString("hex");
  await connectMongo();
  const StaffProfile = await getStaffProfileModel();
  const profile = await StaffProfile.findOne({ email: "paul.thomas@local.coworkprysme.dev" }).exec();
  if (!profile) throw new Error("Staff profile not found");
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

function json(label, value) {
  console.log(`\n=== ${label} ===`);
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

function compareKeys(label, a, b) {
  console.log(`\n--- compare: ${label} ---`);
  console.log("A:", JSON.stringify(a));
  console.log("B:", JSON.stringify(b));
  console.log("equal:", a === b);
  if (a !== b) {
    console.log("len A/B:", a?.length, b?.length);
    for (let i = 0; i < Math.max(a?.length ?? 0, b?.length ?? 0); i++) {
      if (a?.[i] !== b?.[i]) {
        console.log(`diff at ${i}: A=${JSON.stringify(a?.[i])} B=${JSON.stringify(b?.[i])}`);
        break;
      }
    }
  }
}

const SCHEDULE = [
  { day: "monday", is24h: false, openTime: "08:00", closeTime: "19:00" },
  { day: "tuesday", is24h: false, openTime: "08:00", closeTime: "19:00" },
  { day: "wednesday", is24h: false, openTime: "08:00", closeTime: "19:00" },
  { day: "thursday", is24h: false, openTime: "08:00", closeTime: "19:00" },
  { day: "friday", is24h: false, openTime: "08:00", closeTime: "19:00" },
  { day: "saturday", is24h: false, openTime: "08:00", closeTime: "13:00" },
  { day: "sunday", is24h: false, openTime: "00:00", closeTime: "00:00" },
];

const token = await createSessionToken();
const cookie = `gestion_sid=${token}`;

// Step 0: create building
const createPayload = {
  name: `Diag Photo ${Date.now()}`,
  description: "",
  address: { street: "1 rue Test", postalCode: "69003", city: "Lyon", country: "France" },
  floors: [{ name: "RDC" }],
  status: "active",
  accessibilityHours: SCHEDULE,
  receptionHours: SCHEDULE,
  concierge: { link: "", accessCode: "" },
};

const created = await fetch(`${API}/buildings`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify(createPayload),
}).then((r) => r.json());

const buildingId = created.id;
json("Created building id", buildingId);

// Step 1: upload photo (minimal webp from sharp if available, else skip)
let photoBuffer;
try {
  const sharp = (await import("sharp")).default;
  photoBuffer = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#2563eb" },
  })
    .webp()
    .toBuffer();
} catch {
  photoBuffer = readFileSync("/tmp/diag-photo.webp");
}

const formData = new FormData();
formData.append("file", new Blob([photoBuffer], { type: "image/webp" }), "diag.webp");

const afterUpload = await fetch(`${API}/buildings/${buildingId}/photos`, {
  method: "POST",
  headers: { Cookie: cookie },
  body: formData,
}).then(async (r) => ({ status: r.status, body: await r.json() }));

json("After POST /photos HTTP", afterUpload.status);
const storageKeyFromUploadResponse = afterUpload.body.photos?.[0]?.storageKey;
json("2) GET-like after upload — storageKey in API response", storageKeyFromUploadResponse);

// Step 1b: DB value
await connectMongo();
const Building = await getBuildingModel();
const dbDocAfterUpload = await Building.findById(buildingId).lean().exec();
const storageKeyFromDb = dbDocAfterUpload?.photos?.[0]?.storageKey;
json("1) DB after upload — storageKey in cowork_bdd", storageKeyFromDb);

// Step 2: simulate page refresh — GET building
const afterGet = await fetch(`${API}/buildings/${buildingId}`, {
  headers: { Cookie: cookie },
}).then((r) => r.json());
const storageKeyFromGet = afterGet.photos?.[0]?.storageKey;
json("2) GET /buildings/:id — storageKey returned to front", storageKeyFromGet);

// Step 3: simulate front form state (mapApiPhotosToFormPhotos equivalent)
const frontFormStorageKey = afterGet.photos?.[0]?.storageKey;
json("3) Front form state storageKey (same as GET mapper output)", frontFormStorageKey);

// Step 4: simulate handleSave — PATCH building first (updateBuilding)
const patchPayload = {
  name: afterGet.name,
  description: afterGet.description ?? "",
  address: afterGet.address,
  floors: afterGet.floors.map((f) => ({ name: f.name })),
  status: afterGet.status,
  accessibilityHours: afterGet.accessibilityHours,
  receptionHours: afterGet.receptionHours,
  concierge: afterGet.concierge,
};

const afterPatchBuilding = await fetch(`${API}/buildings/${buildingId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify(patchPayload),
}).then(async (r) => ({ status: r.status, body: await r.json() }));

json("PATCH /buildings/:id HTTP", afterPatchBuilding.status);
json("PATCH /buildings/:id response photos[]", afterPatchBuilding.body.photos);

const existingStorageKeysAfterPatch = new Set(
  (afterPatchBuilding.body.photos ?? []).map((p) => p.storageKey),
);
json(
  "existingStorageKeys Set passed to persistBuildingPhotos",
  [...existingStorageKeysAfterPatch],
);

const frontWouldIncludePhoto = existingStorageKeysAfterPatch.has(frontFormStorageKey);
json(
  "Front persistBuildingPhotos: existingStorageKeys.has(form.storageKey)?",
  frontWouldIncludePhoto,
);

// DB after PATCH building
const dbDocAfterPatch = await Building.findById(buildingId).lean().exec();
json("1) DB after PATCH building — photos[]", dbDocAfterPatch?.photos ?? []);

// Step 5: what front would send to PATCH /photos (if it got past the check)
const photosPatchPayload = {
  photos: [
    {
      storageKey: frontFormStorageKey,
      order: 0,
      isPrimary: true,
    },
  ],
};
json("3) Payload PATCH /buildings/:id/photos (what front would send)", photosPatchPayload);

const afterPatchPhotos = await fetch(`${API}/buildings/${buildingId}/photos`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify(photosPatchPayload),
}).then(async (r) => ({
  status: r.status,
  body: await r.text().then((t) => {
    try {
      return JSON.parse(t);
    } catch {
      return t;
    }
  }),
}));

json("PATCH /photos response", afterPatchPhotos);

// Step 6: disk path resolution
if (storageKeyFromDb) {
  const absolutePath = resolveStorageKeyAbsolutePath(UPLOADS_DIR, storageKeyFromDb);
  json("4) Disk lookup — UPLOADS_DIR", UPLOADS_DIR);
  json("4) Disk lookup — absolute path resolved", absolutePath);
  json("4) Disk lookup — file exists?", existsSync(absolutePath));
}

compareKeys("DB vs GET", storageKeyFromDb, storageKeyFromGet);
compareKeys("GET vs front form", storageKeyFromGet, frontFormStorageKey);
compareKeys("front form vs upload response", frontFormStorageKey, storageKeyFromUploadResponse);

console.log("\n=== DIAGNOSIS SUMMARY ===");
if (storageKeyFromDb === storageKeyFromGet && storageKeyFromGet === frontFormStorageKey) {
  console.log("storageKey chain is IDENTICAL across DB / GET / front — NOT a key mismatch.");
} else {
  console.log("storageKey MISMATCH detected between layers.");
}
if ((afterPatchBuilding.body.photos ?? []).length === 0) {
  console.log(
    "ROOT CAUSE CANDIDATE: PATCH /buildings/:id wipes photos[] BEFORE persistBuildingPhotos runs.",
  );
  console.log(
    "existingStorageKeys is empty → persistBuildingPhotos throws 'Unknown photo' on CLIENT without hitting PATCH /photos.",
  );
} else if (!frontWouldIncludePhoto) {
  console.log("ROOT CAUSE: existingStorageKeys does not contain form storageKey.");
}
if (afterPatchPhotos.status === 400 && afterPatchPhotos.body?.message === "Unknown photo") {
  console.log("Server PATCH /photos also rejects with Unknown photo (knownKeys empty in DB).");
}

process.exit(0);
