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

interface FilterPillProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

function FilterPill({ active, label, onClick }: FilterPillProps) {
  return (
    <button
      type="button"
      className={[styles.filterPill, active ? styles.filterPillActive : ""]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
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
    <div className={styles.filtersBar} role="group" aria-label="Filtres des espaces">
      <div className={styles.filterGroup}>
        <span className={styles.filterGroupLabel} id="space-filter-type-label">
          Type
        </span>
        <div className={styles.filterPills} role="group" aria-labelledby="space-filter-type-label">
          <FilterPill
            active={typeFilter === "all"}
            label="Tous"
            onClick={() => onTypeChange("all")}
          />
          <FilterPill
            active={typeFilter === "meeting_room"}
            label="Salle de réunion"
            onClick={() => onTypeChange("meeting_room")}
          />
          <FilterPill
            active={typeFilter === "private_office"}
            label="Bureau"
            onClick={() => onTypeChange("private_office")}
          />
        </div>
      </div>

      <span className={styles.filterDivider} aria-hidden="true">
        |
      </span>

      <div className={styles.filterGroup}>
        <span className={styles.filterGroupLabel} id="space-filter-status-label">
          Statut
        </span>
        <div
          className={styles.filterPills}
          role="group"
          aria-labelledby="space-filter-status-label"
        >
          <FilterPill
            active={statusFilter === "all"}
            label="Tous"
            onClick={() => onStatusChange("all")}
          />
          <FilterPill
            active={statusFilter === "active"}
            label="Actif"
            onClick={() => onStatusChange("active")}
          />
          <FilterPill
            active={statusFilter === "inactive"}
            label="Inactif"
            onClick={() => onStatusChange("inactive")}
          />
          <FilterPill
            active={statusFilter === "archived"}
            label="Archivé"
            onClick={() => onStatusChange("archived")}
          />
        </div>
      </div>
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
