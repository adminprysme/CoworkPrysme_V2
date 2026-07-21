import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconChevronDown } from "@tabler/icons-react";
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

type OpenMenu = "type" | "status" | "display" | null;

const TYPE_OPTIONS: Array<{ value: PlanningTypeFilter; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "meeting_room", label: "Salle de réunion" },
  { value: "private_office", label: "Bureau" },
];

function typeSummary(value: PlanningTypeFilter): string {
  return TYPE_OPTIONS.find((option) => option.value === value)?.label ?? "Tous";
}

function statusSummary(statuses: PlanningPaymentStatusFilter): string {
  if (statuses.size === 0) return "Tous";
  const labels = PLANNING_PAYMENT_FILTER_OPTIONS.filter((option) => statuses.has(option.value)).map(
    (option) => option.label,
  );
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.length} sélectionnés`;
}

function displaySummary(withReservationsOnly: boolean, showCancelled: boolean): string {
  const parts: string[] = [];
  if (withReservationsOnly) parts.push("Avec réservation");
  if (showCancelled) parts.push("Annulées");
  return parts.length > 0 ? parts.join(" · ") : "Tous";
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
  const typeMenuId = useId();
  const statusMenuId = useId();
  const displayMenuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
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
        setOpenMenu(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtersOpen]);

  useEffect(() => {
    if (!openMenu) return;
    function onPointerDown(event: MouseEvent) {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node) || root.contains(event.target)) return;
      setOpenMenu(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenu(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  function toggleMenu(menu: Exclude<OpenMenu, null>) {
    setOpenMenu((current) => (current === menu ? null : menu));
  }

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
        <div className={styles.dropdown}>
          <button
            type="button"
            className={styles.dropdownTrigger}
            aria-expanded={openMenu === "type"}
            aria-haspopup="listbox"
            aria-controls={typeMenuId}
            onClick={() => toggleMenu("type")}
          >
            <span className={styles.dropdownTriggerText}>
              <span className={styles.dropdownGroup}>Type</span>
              <span className={styles.dropdownValue}>{typeSummary(typeFilter)}</span>
            </span>
            <IconChevronDown
              size={16}
              stroke={1.75}
              aria-hidden
              className={styles.dropdownChevron}
            />
          </button>
          {openMenu === "type" ? (
            <div className={styles.dropdownMenu} id={typeMenuId} role="listbox">
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={typeFilter === option.value}
                  className={
                    typeFilter === option.value
                      ? styles.dropdownOptionActive
                      : styles.dropdownOption
                  }
                  onClick={() => {
                    onTypeChange(option.value);
                    setOpenMenu(null);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.dropdown}>
          <button
            type="button"
            className={styles.dropdownTrigger}
            aria-expanded={openMenu === "status"}
            aria-haspopup="true"
            aria-controls={statusMenuId}
            onClick={() => toggleMenu("status")}
          >
            <span className={styles.dropdownTriggerText}>
              <span className={styles.dropdownGroup}>Statut</span>
              <span className={styles.dropdownValue}>{statusSummary(paymentStatuses)}</span>
            </span>
            <IconChevronDown
              size={16}
              stroke={1.75}
              aria-hidden
              className={styles.dropdownChevron}
            />
          </button>
          {openMenu === "status" ? (
            <div className={styles.dropdownMenu} id={statusMenuId} role="group">
              <label className={styles.dropdownCheckOption}>
                <input
                  type="checkbox"
                  checked={paymentAll}
                  onChange={(event) => {
                    if (event.target.checked) {
                      onPaymentStatusesChange(emptyPaymentStatusFilter());
                    }
                  }}
                />
                <span>Tous</span>
              </label>
              {PLANNING_PAYMENT_FILTER_OPTIONS.map((option) => (
                <label key={option.value} className={styles.dropdownCheckOption}>
                  <input
                    type="checkbox"
                    checked={paymentStatuses.has(option.value)}
                    onChange={() => togglePaymentStatus(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.dropdown}>
          <button
            type="button"
            className={styles.dropdownTrigger}
            aria-expanded={openMenu === "display"}
            aria-haspopup="true"
            aria-controls={displayMenuId}
            onClick={() => toggleMenu("display")}
          >
            <span className={styles.dropdownTriggerText}>
              <span className={styles.dropdownGroup}>Affichage</span>
              <span className={styles.dropdownValue}>
                {displaySummary(withReservationsOnly, showCancelled)}
              </span>
            </span>
            <IconChevronDown
              size={16}
              stroke={1.75}
              aria-hidden
              className={styles.dropdownChevron}
            />
          </button>
          {openMenu === "display" ? (
            <div className={styles.dropdownMenu} id={displayMenuId} role="group">
              <label className={styles.dropdownCheckOption}>
                <input
                  type="checkbox"
                  checked={!withReservationsOnly && !showCancelled}
                  onChange={(event) => {
                    if (event.target.checked) {
                      onWithReservationsOnlyChange(false);
                      onShowCancelledChange(false);
                    }
                  }}
                />
                <span>Tous</span>
              </label>
              <label className={styles.dropdownCheckOption}>
                <input
                  type="checkbox"
                  checked={withReservationsOnly}
                  onChange={() => onWithReservationsOnlyChange(!withReservationsOnly)}
                />
                <span>Avec réservation uniquement</span>
              </label>
              <label className={styles.dropdownCheckOption}>
                <input
                  type="checkbox"
                  checked={showCancelled}
                  onChange={() => onShowCancelledChange(!showCancelled)}
                />
                <span>Afficher les annulées</span>
              </label>
            </div>
          ) : null}
        </div>
      </div>

      <label className={styles.sortControl}>
        <span className={styles.sortLabel}>
          <span className={styles.sortLabelFull}>Trier par</span>
          <span className={styles.sortLabelShort}>Trier</span>
        </span>
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
    <div className={styles.barWrap} ref={rootRef}>
      {searchSlot ? <div className={styles.searchSlot}>{searchSlot}</div> : null}

      <div className={styles.filtersToggleWrap}>
        <button
          type="button"
          className={styles.filtersToggle}
          aria-expanded={filtersOpen}
          aria-controls={panelTitleId}
          onClick={() => {
            setOpenMenu(null);
            setFiltersOpen(true);
          }}
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
