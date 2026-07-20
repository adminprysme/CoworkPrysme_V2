import type { PlanningPaymentStatus, PlanningSpaceRow } from "@coworkprysme/shared";

import {
  emptyPaymentStatusFilter,
  hasActivePlanningFilters,
  PLANNING_PAYMENT_FILTER_OPTIONS,
  type PlanningPaymentStatusFilter,
  type PlanningSpaceFilter,
  type PlanningTypeFilter,
} from "../planning-filters.js";
import { PLANNING_SPACE_SORT_OPTIONS, type PlanningSpaceSort } from "../planning-sort.js";
import styles from "./PlanningFiltersBar.module.css";

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

export interface PlanningFiltersBarProps {
  spaces: PlanningSpaceRow[];
  typeFilter: PlanningTypeFilter;
  paymentStatuses: PlanningPaymentStatusFilter;
  spaceFilter: PlanningSpaceFilter;
  sort: PlanningSpaceSort;
  onTypeChange: (value: PlanningTypeFilter) => void;
  onPaymentStatusesChange: (value: PlanningPaymentStatusFilter) => void;
  onSpaceChange: (value: PlanningSpaceFilter) => void;
  onSortChange: (value: PlanningSpaceSort) => void;
  onReset: () => void;
}

export function PlanningFiltersBar({
  spaces,
  typeFilter,
  paymentStatuses,
  spaceFilter,
  sort,
  onTypeChange,
  onPaymentStatusesChange,
  onSpaceChange,
  onSortChange,
  onReset,
}: PlanningFiltersBarProps) {
  const showReset = hasActivePlanningFilters({ typeFilter, paymentStatuses, spaceFilter });
  const paymentAll = paymentStatuses.size === 0;

  function togglePaymentStatus(status: PlanningPaymentStatus) {
    const next = new Set(paymentStatuses);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    onPaymentStatusesChange(next);
  }

  return (
    <div className={styles.barWrap}>
      <div className={styles.filtersBar} role="group" aria-label="Filtres du planning">
        <div className={styles.filterGroup}>
          <span className={styles.filterGroupLabel} id="planning-filter-type-label">
            Type
          </span>
          <div
            className={styles.filterPills}
            role="group"
            aria-labelledby="planning-filter-type-label"
          >
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
          <span className={styles.filterGroupLabel} id="planning-filter-status-label">
            Statut
          </span>
          <div
            className={styles.filterPills}
            role="group"
            aria-labelledby="planning-filter-status-label"
          >
            <FilterPill
              active={paymentAll}
              label="Tous"
              onClick={() => onPaymentStatusesChange(emptyPaymentStatusFilter())}
            />
            {PLANNING_PAYMENT_FILTER_OPTIONS.map((option) => (
              <FilterPill
                key={option.value}
                active={paymentStatuses.has(option.value)}
                label={option.label}
                onClick={() => togglePaymentStatus(option.value)}
              />
            ))}
          </div>
        </div>

        <span className={styles.filterDivider} aria-hidden="true">
          |
        </span>

        <div className={styles.filterGroup}>
          <span className={styles.filterGroupLabel} id="planning-filter-space-label">
            Espace
          </span>
          <div
            className={styles.filterPills}
            role="group"
            aria-labelledby="planning-filter-space-label"
          >
            <FilterPill
              active={spaceFilter === "all"}
              label="Tous"
              onClick={() => onSpaceChange("all")}
            />
            {spaces.map((space) => (
              <FilterPill
                key={space.id}
                active={spaceFilter === space.id}
                label={space.name}
                onClick={() => onSpaceChange(space.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <label className={styles.sortControl}>
        <span className={styles.sortLabel}>Trier par</span>
        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as PlanningSpaceSort)}
        >
          {PLANNING_SPACE_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {showReset ? (
        <button type="button" className={styles.resetBtn} onClick={onReset}>
          Réinitialiser
        </button>
      ) : null}
    </div>
  );
}
