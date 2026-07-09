import type { MetadataRoute } from "next";

import { ALL_SITEMAP_PATHS, SITE_URL } from "@/config/site";
import { getCatalogBuildings } from "@/lib/get-catalog-content";

const CATALOG_ROOT_PATHS = new Set(["/bureaux-privatifs", "/salle-de-reunion", "/tarifs"]);

function catalogPathsForBuilding(slug: string): string[] {
  return [`/bureaux-privatifs/${slug}`, `/salle-de-reunion/${slug}`, `/tarifs/${slug}`];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const staticPaths = ALL_SITEMAP_PATHS.filter((path) => !CATALOG_ROOT_PATHS.has(path));
  const catalogData = await getCatalogBuildings();
  const catalogPaths = (catalogData?.buildings ?? []).flatMap((building) =>
    catalogPathsForBuilding(building.slug),
  );

  const paths = [...staticPaths, ...catalogPaths];

  return paths.map((path) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
