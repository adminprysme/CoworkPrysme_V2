import type { Building } from "../types.js";
import { formatAddressSummary } from "../utils/schedule.js";
import styles from "./BuildingCard.module.css";

interface BuildingCardProps {
  building: Building;
  onOpen: () => void;
}

export function BuildingCard({ building, onOpen }: BuildingCardProps) {
  const mainPhoto = building.photos[0]?.previewUrl;

  return (
    <button type="button" className={styles.card} onClick={onOpen}>
      {mainPhoto ? (
        <img src={mainPhoto} alt="" className={styles.thumbnail} />
      ) : (
        <span className={styles.thumbnailFallback} aria-hidden="true">
          Photo
        </span>
      )}

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{building.name}</h3>
          <span
            className={[
              styles.badge,
              building.status === "active" ? styles.badgeActive : styles.badgeInactive,
            ].join(" ")}
          >
            {building.status === "active" ? "Actif" : "Inactif"}
          </span>
        </div>
        <p className={styles.address}>{formatAddressSummary(building.address)}</p>
        <p className={styles.meta}>
          {building.floors.length} étage{building.floors.length > 1 ? "s" : ""}
          {" · "}
          {building.spaceCount ?? 0} espace{(building.spaceCount ?? 0) > 1 ? "s" : ""}
        </p>
      </div>
    </button>
  );
}
