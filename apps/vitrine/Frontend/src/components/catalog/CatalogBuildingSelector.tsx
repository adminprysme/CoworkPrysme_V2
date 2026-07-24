import Link from "next/link";

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
  if (buildings.length <= 1) {
    return null;
  }

  return (
    <nav className={styles.selectorWrap} aria-label="Choisir un site">
      <p className={styles.selectorLabel}>Choisir un site</p>
      <div className={styles.selectorPills} role="list">
        {buildings.map((building) => {
          const href = `${basePath}/${building.slug}`;
          const isActive = building.slug === currentSlug;

          return (
            <Link
              key={building.id}
              href={href}
              prefetch
              role="listitem"
              className={[styles.selectorPill, isActive ? styles.selectorPillActive : ""]
                .filter(Boolean)
                .join(" ")}
              aria-current={isActive ? "page" : undefined}
            >
              <span className={styles.selectorPillName}>{building.name}</span>
              <span className={styles.selectorPillCity}>{building.city}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
