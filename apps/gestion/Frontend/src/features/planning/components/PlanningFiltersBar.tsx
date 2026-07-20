import type { ReactNode } from "react";
import type { PlanningPaymentStatus } from "@coworkprysme/shared";

import {
  emptyPaymentStatusFilter,
  hasActivePlanningFilters,
  PLANNING_PAYMENT_FILTER_OPTIONS,
  type PlanningPaymentStatusFilter,
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
  typeFilter: PlanningTypeFilter;
  paymentStatuses: PlanningPaymentStatusFilter;
  withReservationsOnly: boolean;
  sort: PlanningSpaceSort;
  onTypeChange: (value: PlanningTypeFilter) => void;
  onPaymentStatusesChange: (value: PlanningPaymentStatusFilter) => void;
  onWithReservationsOnlyChange: (value: boolean) => void;
  onSortChange: (value: PlanningSpaceSort) => void;
  onReset: () => void;
  searchSlot?: ReactNode;
}

export function PlanningFiltersBar({
  typeFilter,
  paymentStatuses,
  withReservationsOnly,
  sort,
  onTypeChange,
  onPaymentStatusesChange,
  onWithReservationsOnlyChange,
  onSortChange,
  onReset,
  searchSlot,
}: PlanningFiltersBarProps) {
  const showReset = hasActivePlanningFilters({
    typeFilter,
    paymentStatuses,
    withReservationsOnly,
  });
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
      {searchSlot ? <div className={styles.searchSlot}>{searchSlot}</div> : null}

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
          <span className={styles.filterGroupLabel} id="planning-filter-occupancy-label">
            Affichage
          </span>
          <div
            className={styles.filterPills}
            role="group"
            aria-labelledby="planning-filter-occupancy-label"
          >
            <FilterPill
              active={!withReservationsOnly}
              label="Tous"
              onClick={() => onWithReservationsOnlyChange(false)}
            />
            <FilterPill
              active={withReservationsOnly}
              label="Avec réservation uniquement"
              onClick={() => onWithReservationsOnlyChange(true)}
            />
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
