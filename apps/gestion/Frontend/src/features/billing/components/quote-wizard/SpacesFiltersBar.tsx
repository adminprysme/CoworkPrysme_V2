import { IconSearch } from "@tabler/icons-react";
import type { BuildingResponse } from "@coworkprysme/shared";

import pageStyles from "../../BillingPages.module.css";
import { QuoteDurationRangeField } from "./QuoteDurationRangeField.js";
import styles from "./QuoteWizard.module.css";

type SpacesFiltersBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  periodStartLocal: string;
  periodEndLocal: string;
  onPeriodChange: (next: { startLocal: string; endLocal: string }) => void;
  periodPartySize: number;
  onPeriodPartySizeChange: (value: number) => void;
  onClearPeriod: () => void;
  showBuildingFilter: boolean;
  buildings: BuildingResponse[];
  buildingFilter: string;
  onBuildingFilterChange: (value: string) => void;
  minCapacity: number;
  onMinCapacityChange: (value: number) => void;
};

export function SpacesFiltersBar({
  search,
  onSearchChange,
  periodStartLocal,
  periodEndLocal,
  onPeriodChange,
  periodPartySize,
  onPeriodPartySizeChange,
  onClearPeriod,
  showBuildingFilter,
  buildings,
  buildingFilter,
  onBuildingFilterChange,
  minCapacity,
  onMinCapacityChange,
}: SpacesFiltersBarProps) {
  const hasPeriod = Boolean(periodStartLocal || periodEndLocal);

  return (
    <div
      className={styles.catalogFilters}
      role="group"
      aria-label="Filtres des espaces"
      data-spaces-filters="true"
    >
      <label className={`${pageStyles.label} ${styles.filterSearch}`}>
        Rechercher
        <span className={styles.filterSearchField}>
          <IconSearch size={16} stroke={1.75} aria-hidden="true" />
          <input
            className={pageStyles.input}
            type="search"
            placeholder="Nom ou bâtiment…"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </span>
      </label>

      <div className={styles.filterPeriod}>
        <QuoteDurationRangeField
          label="Période"
          startLocal={periodStartLocal}
          endLocal={periodEndLocal}
          onChange={onPeriodChange}
        />
      </div>

      <label className={`${pageStyles.label} ${styles.filterParty}`}>
        Personnes
        <input
          className={pageStyles.input}
          type="number"
          min={1}
          max={500}
          value={periodPartySize}
          onChange={(event) =>
            onPeriodPartySizeChange(Math.max(1, Number(event.target.value) || 1))
          }
          aria-label="Nombre de personnes"
        />
      </label>

      {showBuildingFilter ? (
        <label className={`${pageStyles.label} ${styles.filterBuilding}`}>
          Bâtiment
          <select
            className={pageStyles.input}
            value={buildingFilter}
            onChange={(event) => onBuildingFilterChange(event.target.value)}
          >
            <option value="">Tous</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className={`${pageStyles.label} ${styles.filterCapacity}`}>
        Capacité min.
        <input
          className={pageStyles.input}
          type="number"
          min={0}
          placeholder="0"
          value={minCapacity || ""}
          onChange={(event) => onMinCapacityChange(Math.max(0, Number(event.target.value) || 0))}
        />
      </label>

      {hasPeriod ? (
        <button type="button" className={styles.filterClearButton} onClick={onClearPeriod}>
          Effacer période
        </button>
      ) : null}
    </div>
  );
}
