/**
 * Bootstrap vitrine catalog flags on the Cowork Gerland building.
 *
 * Sets visibleOnVitrine: true and isDefaultVitrineBuilding: true on the building
 * whose name matches /^Cowork Gerland$/i. Clears isDefaultVitrineBuilding on
 * any other building first.
 *
 * Usage (from repo root, with .env loaded):
 *   node apps/gestion/Backend/scripts/bootstrap-vitrine-catalog-buildings.mjs
 */
import { connectMongo, getBuildingModel } from "@coworkprysme/db";

const BUILDING_NAME_PATTERN = /^Cowork Gerland$/i;

async function main() {
  await connectMongo();
  const Building = await getBuildingModel();

  const target = await Building.findOne({ name: BUILDING_NAME_PATTERN }).exec();
  if (!target) {
    console.error(
      `[bootstrap-vitrine-catalog] No building matched ${BUILDING_NAME_PATTERN}. Aborting.`,
    );
    process.exit(1);
  }

  await Building.updateMany(
    { _id: { $ne: target._id }, isDefaultVitrineBuilding: true },
    { $set: { isDefaultVitrineBuilding: false } },
  ).exec();

  target.visibleOnVitrine = true;
  target.isDefaultVitrineBuilding = true;
  await target.save();

  console.log(
    `[bootstrap-vitrine-catalog] Updated building ${target._id.toString()} (${target.name}):`,
    {
      visibleOnVitrine: target.visibleOnVitrine,
      isDefaultVitrineBuilding: target.isDefaultVitrineBuilding,
    },
  );
}

main().catch((error) => {
  console.error("[bootstrap-vitrine-catalog] Failed:", error);
  process.exit(1);
});
