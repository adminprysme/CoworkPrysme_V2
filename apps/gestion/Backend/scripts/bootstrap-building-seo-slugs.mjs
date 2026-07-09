/**
 * Backfill building SEO slugs for catalogue URLs.
 *
 * Usage (from repo root, with .env loaded):
 *   node apps/gestion/Backend/scripts/bootstrap-building-seo-slugs.mjs
 */
import {
  buildBuildingSeoMeta,
  resolveUniqueSlugFromSet,
  slugifyBuildingName,
} from "@coworkprysme/shared";
import { connectMongo, getBuildingModel } from "@coworkprysme/db";

const COWORK_GERLAND_PATTERN = /^Cowork\s+GERLAND$/i;

async function main() {
  await connectMongo();
  const Building = await getBuildingModel();
  const buildings = await Building.find({}).exec();

  if (buildings.length === 0) {
    console.error("[bootstrap-building-seo-slugs] No buildings found. Aborting.");
    process.exit(1);
  }

  const takenSlugs = new Set(
    buildings.map((building) => building.seo?.slug).filter((slug) => typeof slug === "string"),
  );

  for (const building of buildings) {
    if (building.seo?.slug) {
      console.log(
        `[bootstrap-building-seo-slugs] Skip ${building._id.toString()} (${building.name}) — already has slug ${building.seo.slug}`,
      );
      continue;
    }

    const baseSlug = slugifyBuildingName(building.name);
    const seoMeta = buildBuildingSeoMeta(building.name, building.description);
    const slug = resolveUniqueSlugFromSet(baseSlug, takenSlugs);
    takenSlugs.add(slug);

    building.seo = { ...seoMeta, slug };
    await building.save();

    const gerlandMatch = COWORK_GERLAND_PATTERN.test(building.name);
    console.log(
      `[bootstrap-building-seo-slugs] Updated ${building._id.toString()} (${building.name}) → slug=${slug}${gerlandMatch ? " [Cowork GERLAND match]" : ""}`,
    );
  }

  const gerland = await Building.findOne({ name: COWORK_GERLAND_PATTERN }).lean().exec();
  if (!gerland?.seo?.slug) {
    console.error(
      "[bootstrap-building-seo-slugs] Cowork GERLAND not found or missing slug after migration.",
    );
    process.exit(1);
  }

  console.log(
    `[bootstrap-building-seo-slugs] Cowork GERLAND slug confirmed: ${gerland.seo.slug}`,
  );
}

main().catch((error) => {
  console.error("[bootstrap-building-seo-slugs] Failed:", error);
  process.exit(1);
});
