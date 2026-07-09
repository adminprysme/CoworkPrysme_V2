"use client";

import { useRouter } from "next/navigation";

import type { CatalogBuildingSummary } from "@coworkprysme/shared";

import styles from "./catalog.module.css";

interface CatalogBuildingSelectorProps {
  buildings: CatalogBuildingSummary[];
  currentSlug: string;
  basePath: string;
}

export function CatalogBuildingSelector({
  buildings,
  currentSlug,
  basePath,
}: CatalogBuildingSelectorProps) {
  const router = useRouter();

  if (buildings.length <= 1) {
    return null;
  }

  return (
    <div className={styles.selectorWrap}>
      <label className={styles.selectorLabel} htmlFor="catalog-building-selector">
        Choisir un site
      </label>
      <select
        id="catalog-building-selector"
        className={styles.selector}
        value={currentSlug}
        onChange={(event) => router.push(`${basePath}/${event.target.value}`)}
      >
        {buildings.map((building) => (
          <option key={building.id} value={building.slug}>
            {building.name} — {building.city}
          </option>
        ))}
      </select>
    </div>
  );
}
