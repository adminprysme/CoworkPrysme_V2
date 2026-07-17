/**
 * Remove SEO-slug collision demo leftovers: the two orphan "Salon Identique" spaces
 * and any photo files still on the uploads volume.
 *
 * Usage (from repo root):
 *   node --env-file=apps/gestion/Backend/.env apps/gestion/Backend/scripts/cleanup-orphan-salon-identique.mjs
 */
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { connectMongo, getSpaceModel } from "@coworkprysme/db";
import { resolveStorageKeyAbsolutePath } from "@coworkprysme/shared/server";

const SPACE_IDS = ["6a451c7d411db28e72f87192", "6a451c7d411db28e72f87193"];

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../../..");
const uploadsDir = process.env.UPLOADS_DIR?.trim() || resolve(repoRoot, "uploads");

async function main() {
  await connectMongo();
  const Space = await getSpaceModel();

  const before = await Space.find({ _id: { $in: SPACE_IDS } })
    .select({ name: 1, buildingId: 1, photos: 1, "seo.slug": 1, status: 1 })
    .lean()
    .exec();

  console.log(`[cleanup-orphan-salon-identique] Avant: ${before.length} document(s)`);
  for (const doc of before) {
    console.log(
      `  - ${doc._id.toString()} name=${doc.name} slug=${doc.seo?.slug} buildingId=${doc.buildingId?.toString()} photos=${(doc.photos ?? []).length}`,
    );
  }

  if (before.length === 0) {
    console.log("[cleanup-orphan-salon-identique] Rien à faire.");
    process.exit(0);
  }

  const unexpected = before.filter((doc) => doc.name !== "Salon Identique");
  if (unexpected.length > 0) {
    console.error(
      "[cleanup-orphan-salon-identique] Abort: unexpected space name(s):",
      unexpected.map((doc) => `${doc._id.toString()}=${doc.name}`),
    );
    process.exit(1);
  }

  const storageKeys = before.flatMap((doc) =>
    (doc.photos ?? []).map((photo) => photo.storageKey).filter(Boolean),
  );

  for (const storageKey of storageKeys) {
    const absolute = resolveStorageKeyAbsolutePath(uploadsDir, storageKey);
    if (!absolute) {
      console.warn(`  ! invalid storageKey skipped: ${storageKey}`);
      continue;
    }
    if (!existsSync(absolute)) {
      console.log(`  - photo already absent: ${storageKey}`);
      continue;
    }
    rmSync(absolute);
    console.log(`  - deleted photo file: ${absolute}`);
    const parentDir = dirname(absolute);
    try {
      rmSync(parentDir, { recursive: true });
      console.log(`  - removed empty space dir: ${parentDir}`);
    } catch {
      // dir not empty or already gone
    }
  }

  const deleteResult = await Space.deleteMany({ _id: { $in: SPACE_IDS } });
  console.log(
    `[cleanup-orphan-salon-identique] deleteMany deletedCount=${deleteResult.deletedCount}`,
  );

  const after = await Space.find({ _id: { $in: SPACE_IDS } })
    .select({ _id: 1 })
    .lean()
    .exec();
  const byName = await Space.countDocuments({ name: "Salon Identique" });

  console.log(`[cleanup-orphan-salon-identique] Après: docs by id=${after.length}, by name=${byName}`);
  for (const storageKey of storageKeys) {
    const absolute = resolveStorageKeyAbsolutePath(uploadsDir, storageKey);
    console.log(
      `  - photo ${storageKey}: ${absolute && existsSync(absolute) ? "STILL ON DISK" : "gone"}`,
    );
  }

  if (after.length > 0 || byName > 0) {
    console.error("[cleanup-orphan-salon-identique] ÉCHEC: des documents restent.");
    process.exit(1);
  }

  console.log("[cleanup-orphan-salon-identique] OK");
  process.exit(0);
}

main().catch((error) => {
  console.error("[cleanup-orphan-salon-identique] Fatal:", error);
  process.exit(1);
});
