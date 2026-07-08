/**
 * One-shot cleanup after vitrine-content audit tests:
 * - restore marquee to default neutral text
 * - drop heroImages keys whose files are missing from the uploads volume
 *
 * Usage (from repo root):
 *   node apps/gestion/Backend/scripts/cleanup-vitrine-audit-residue.mjs
 */
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import mongoose from "../../../../packages/db/node_modules/mongoose/index.js";

import {
  DEFAULT_HOME_PUBLIC_CONTENT,
  DEFAULT_VITRINE_MARQUEE_TEXT,
  mediaPathFromVitrineStorageKey,
} from "@coworkprysme/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const SINGLETON_ID = "singleton";
const HERO_KEY_PATTERN =
  /^vitrine\/(hero|concept|room-service|afterwork|conciergerie)\/[0-9a-f-]{36}\.webp$/;

function resolveStorageKeyAbsolutePath(uploadsDir, storageKey) {
  const absoluteUploads = path.resolve(uploadsDir);
  const absoluteTarget = path.resolve(absoluteUploads, storageKey);
  const uploadsPrefix = absoluteUploads.endsWith(path.sep)
    ? absoluteUploads
    : `${absoluteUploads}${path.sep}`;
  if (!absoluteTarget.startsWith(uploadsPrefix)) {
    return null;
  }
  return absoluteTarget;
}

function buildPublicImageUrl(storageKey, fallback, apiOrigin) {
  if (!storageKey) {
    return fallback;
  }
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
    return storageKey;
  }
  return `${apiOrigin}${mediaPathFromVitrineStorageKey(storageKey)}`;
}

function mergeHomePublicContent(stored, apiOrigin) {
  const defaults = DEFAULT_HOME_PUBLIC_CONTENT;
  const heroImages =
    stored.heroImages.length > 0
      ? stored.heroImages.map((key) => buildPublicImageUrl(key, defaults.heroImages[0], apiOrigin))
      : defaults.heroImages;

  return {
    heroImages,
    conceptImage: buildPublicImageUrl(stored.conceptImage, defaults.conceptImage, apiOrigin),
    serviceImages: {
      roomService: buildPublicImageUrl(
        stored.serviceImages.roomService,
        defaults.serviceImages.roomService,
        apiOrigin,
      ),
      afterwork: buildPublicImageUrl(
        stored.serviceImages.afterwork,
        defaults.serviceImages.afterwork,
        apiOrigin,
      ),
      conciergerie: buildPublicImageUrl(
        stored.serviceImages.conciergerie,
        defaults.serviceImages.conciergerie,
        apiOrigin,
      ),
    },
    marquee: {
      enabled: stored.marquee.enabled,
      text: stored.marquee.text.trim() || defaults.marquee.text,
    },
  };
}

async function fileExists(absolutePath) {
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is required");
}

const uploadsDir = process.env.UPLOADS_DIR?.trim()
  ? path.resolve(process.env.UPLOADS_DIR.trim())
  : path.resolve(REPO_ROOT, "uploads");

await mongoose.connect(uri);
const collection = mongoose.connection.getClient().db("cowork_bdd").collection("vitrineContent");
const doc = await collection.findOne({ _id: SINGLETON_ID });

if (!doc) {
  throw new Error(`vitrineContent document ${SINGLETON_ID} not found`);
}

const heroImages = [];
for (const storageKey of doc.heroImages ?? []) {
  if (!HERO_KEY_PATTERN.test(storageKey)) {
    console.log(`skip invalid hero key: ${storageKey}`);
    continue;
  }
  const absolutePath = resolveStorageKeyAbsolutePath(uploadsDir, storageKey);
  if (absolutePath && (await fileExists(absolutePath))) {
    heroImages.push(storageKey);
  } else {
    console.log(`remove orphan hero key: ${storageKey}`);
  }
}

const marquee = {
  enabled: true,
  text: DEFAULT_VITRINE_MARQUEE_TEXT,
};

await collection.updateOne(
  { _id: SINGLETON_ID },
  {
    $set: {
      heroImages,
      marquee,
      updatedAt: new Date(),
    },
  },
);

const updated = await collection.findOne({ _id: SINGLETON_ID });
console.log("=== DB state after cleanup ===");
console.log(JSON.stringify({ heroImages: updated.heroImages, marquee: updated.marquee }, null, 2));
console.log("=== GET /home-content (equivalent payload) ===");
console.log(JSON.stringify(mergeHomePublicContent(updated, "http://localhost:8002"), null, 2));

await mongoose.disconnect();
