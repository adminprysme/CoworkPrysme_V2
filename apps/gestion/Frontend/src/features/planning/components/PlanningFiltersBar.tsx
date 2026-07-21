import { useEffect, useId, useState, type ReactNode } from "react";
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
  showCancelled: boolean;
  sort: PlanningSpaceSort;
  onTypeChange: (value: PlanningTypeFilter) => void;
  onPaymentStatusesChange: (value: PlanningPaymentStatusFilter) => void;
  onWithReservationsOnlyChange: (value: boolean) => void;
  onShowCancelledChange: (value: boolean) => void;
  onSortChange: (value: PlanningSpaceSort) => void;
  onReset: () => void;
  searchSlot?: ReactNode;
}

export function PlanningFiltersBar({
  typeFilter,
  paymentStatuses,
  withReservationsOnly,
  showCancelled,
  sort,
  onTypeChange,
  onPaymentStatusesChange,
  onWithReservationsOnlyChange,
  onShowCancelledChange,
  onSortChange,
  onReset,
  searchSlot,
}: PlanningFiltersBarProps) {
  const panelTitleId = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const showReset = hasActivePlanningFilters({
    typeFilter,
    paymentStatuses,
    withReservationsOnly,
    showCancelled,
  });
  const paymentAll = paymentStatuses.size === 0;
  const activeFilterCount =
    (typeFilter !== "all" ? 1 : 0) +
    paymentStatuses.size +
    (withReservationsOnly ? 1 : 0) +
    (showCancelled ? 1 : 0);

  useEffect(() => {
    if (!filtersOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFiltersOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtersOpen]);

  function togglePaymentStatus(status: PlanningPaymentStatus) {
    const next = new Set(paymentStatuses);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    onPaymentStatusesChange(next);
  }

  const filtersBody = (
    <>
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
            <FilterPill
              active={showCancelled}
              label="Afficher les annulées"
              onClick={() => onShowCancelledChange(!showCancelled)}
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
    </>
  );

  return (
    <div className={styles.barWrap}>
      {searchSlot ? <div className={styles.searchSlot}>{searchSlot}</div> : null}

      <div className={styles.mobileActions}>
        <button
          type="button"
          className={styles.filtersToggle}
          aria-expanded={filtersOpen}
          aria-controls={panelTitleId}
          onClick={() => setFiltersOpen(true)}
        >
          Filtres
          {activeFilterCount > 0 ? (
            <span className={styles.filtersBadge}>{activeFilterCount}</span>
          ) : null}
        </button>
      </div>

      <div className={styles.desktopFilters}>{filtersBody}</div>

      {filtersOpen ? (
        <>
          <button
            type="button"
            className={styles.filtersBackdrop}
            aria-label="Fermer les filtres"
            onClick={() => setFiltersOpen(false)}
          />
          <div
            className={styles.filtersSheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby={panelTitleId}
          >
            <div className={styles.filtersSheetHeader}>
              <h3 id={panelTitleId} className={styles.filtersSheetTitle}>
                Filtres
              </h3>
              <button
                type="button"
                className={styles.filtersSheetClose}
                onClick={() => setFiltersOpen(false)}
              >
                Fermer
              </button>
            </div>
            <div className={styles.filtersSheetBody}>{filtersBody}</div>
          </div>
        </>
      ) : null}
    </div>
  );
}
