import type { Space, SpaceStatusFilter, SpaceTypeFilter } from "../space-types.js";
import { SPACE_TYPE_LABELS } from "../space-types.js";
import { SPACE_STATUS_LABELS } from "../utils/space-status.js";
import styles from "./SpaceCard.module.css";

interface SpaceCardProps {
  space: Space;
  selected: boolean;
  onSelect: () => void;
}

function statusBadgeClass(status: Space["status"]): string {
  if (status === "active") {
    return styles.badgeActive ?? "";
  }
  if (status === "archived") {
    return styles.badgeArchived ?? "";
  }
  return styles.badgeInactive ?? "";
}

export function SpaceCard({ space, selected, onSelect }: SpaceCardProps) {
  const mainPhoto = space.photos[0]?.previewUrl;
  const visibleEquipments = space.equipments.slice(0, 4);
  const hiddenCount = space.equipments.length - visibleEquipments.length;

  return (
    <button
      type="button"
      className={[styles.card, selected ? styles.cardSelected : ""].filter(Boolean).join(" ")}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {mainPhoto ? (
        <img src={mainPhoto} alt="" className={styles.thumbnail} />
      ) : (
        <span className={styles.thumbnailFallback} aria-hidden="true">
          Espace
        </span>
      )}

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{space.name}</h3>
          <span className={[styles.badge, styles.badgeType].join(" ")}>
            {SPACE_TYPE_LABELS[space.type]}
          </span>
        </div>

        <p className={styles.meta}>
          {space.floor} · {space.capacity} pers.
        </p>

        <div className={styles.badges}>
          <span className={[styles.badge, statusBadgeClass(space.status)].join(" ")}>
            {SPACE_STATUS_LABELS[space.status]}
          </span>
        </div>

        {visibleEquipments.length > 0 ? (
          <ul className={styles.equipments} aria-label="Équipements">
            {visibleEquipments.map((equipment) => (
              <li key={equipment.key}>{equipment.label}</li>
            ))}
            {hiddenCount > 0 ? <li className={styles.equipmentsMore}>+{hiddenCount}</li> : null}
          </ul>
        ) : null}
      </div>
    </button>
  );
}

interface SpaceFiltersProps {
  typeFilter: SpaceTypeFilter;
  statusFilter: SpaceStatusFilter;
  onTypeChange: (value: SpaceTypeFilter) => void;
  onStatusChange: (value: SpaceStatusFilter) => void;
}

export function SpaceFilters({
  typeFilter,
  statusFilter,
  onTypeChange,
  onStatusChange,
}: SpaceFiltersProps) {
  return (
    <div className={styles.filters} role="group" aria-label="Filtres des espaces">
      <label className={styles.filterField}>
        <span className={styles.filterLabel}>Type</span>
        <select
          className={styles.filterSelect}
          value={typeFilter}
          onChange={(event) => onTypeChange(event.target.value as SpaceTypeFilter)}
        >
          <option value="all">Tous les types</option>
          <option value="meeting_room">Salles de réunion</option>
          <option value="private_office">Bureaux privatifs</option>
        </select>
      </label>

      <label className={styles.filterField}>
        <span className={styles.filterLabel}>Statut</span>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(event) => onStatusChange(event.target.value as SpaceStatusFilter)}
        >
          <option value="all">Tous</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
          <option value="archived">Archivés</option>
        </select>
      </label>
    </div>
  );
}

export function filterSpaces(
  spaces: Space[],
  typeFilter: SpaceTypeFilter,
  statusFilter: SpaceStatusFilter,
): Space[] {
  return spaces.filter((space) => {
    if (typeFilter !== "all" && space.type !== typeFilter) {
      return false;
    }
    if (statusFilter === "all" && space.status === "archived") {
      return false;
    }
    if (statusFilter !== "all" && space.status !== statusFilter) {
      return false;
    }
    return true;
  });
}
