/**
 * Backfill isGlobal: true on legacy services missing scope fields.
 *
 * Targets documents where neither `isGlobal` nor `buildingIds` was set
 * explicitly (pre-schema docs). Matches the Mongoose default for new services.
 *
 * Usage (from repo root, with DB env loaded):
 *   node --env-file=apps/gestion/Backend/.env apps/gestion/Backend/scripts/backfill-service-is-global.mjs
 *   # or:
 *   set -a && . apps/gestion/Backend/.env && set +a && node apps/gestion/Backend/scripts/backfill-service-is-global.mjs
 */
import { connectMongo, getServiceModel } from "@coworkprysme/db";

const incompleteFilter = {
  isGlobal: { $exists: false },
  buildingIds: { $exists: false },
};

async function main() {
  await connectMongo();
  const Service = await getServiceModel();

  const before = await Service.find(incompleteFilter)
    .select({ key: 1, label: 1, status: 1, isGlobal: 1, buildingIds: 1 })
    .lean()
    .exec();

  console.log(`[backfill-service-is-global] Documents concernés: ${before.length}`);
  for (const doc of before) {
    console.log(
      `  - ${doc._id.toString()} key=${doc.key} label=${JSON.stringify(doc.label)} status=${doc.status} isGlobal=${String(doc.isGlobal)} buildingIds=${JSON.stringify(doc.buildingIds)}`,
    );
  }

  if (before.length === 0) {
    console.log("[backfill-service-is-global] Rien à faire.");
    process.exit(0);
  }

  const result = await Service.updateMany(incompleteFilter, {
    $set: { isGlobal: true },
  });

  console.log(
    `[backfill-service-is-global] updateMany matched=${result.matchedCount} modified=${result.modifiedCount}`,
  );

  const ids = before.map((doc) => doc._id);
  const after = await Service.find({ _id: { $in: ids } })
    .select({ key: 1, label: 1, status: 1, isGlobal: 1, buildingIds: 1 })
    .lean()
    .exec();

  console.log("[backfill-service-is-global] État après correction:");
  for (const doc of after) {
    console.log(
      `  - ${doc._id.toString()} key=${doc.key} isGlobal=${String(doc.isGlobal)} buildingIds=${JSON.stringify(doc.buildingIds)}`,
    );
  }

  const stillIncomplete = await Service.countDocuments(incompleteFilter);
  if (stillIncomplete > 0) {
    console.error(
      `[backfill-service-is-global] ÉCHEC: ${stillIncomplete} document(s) encore incomplets.`,
    );
    process.exit(1);
  }

  console.log("[backfill-service-is-global] OK — plus aucun service sans isGlobal/buildingIds.");
  process.exit(0);
}

main().catch((error) => {
  console.error("[backfill-service-is-global] Fatal:", error);
  process.exit(1);
});
