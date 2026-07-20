import type { PlanningPaymentStatus, PlanningViewMode } from "@coworkprysme/shared";

import {
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  VIEW_MODE_LABELS,
} from "../planning-utils.js";
import styles from "./PlanningToolbar.module.css";

interface PlanningToolbarProps {
  mode: PlanningViewMode;
  rangeLabel: string;
  buildings: Array<{ id: string; name: string }>;
  buildingId: string | "all";
  loading: boolean;
  error: string | null;
  onModeChange: (mode: PlanningViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onBuildingChange: (buildingId: string | "all") => void;
}

export function PlanningToolbar({
  mode,
  rangeLabel,
  buildings,
  buildingId,
  loading,
  error,
  onModeChange,
  onPrev,
  onNext,
  onToday,
  onBuildingChange,
}: PlanningToolbarProps) {
  return (
    <div className={styles.controls}>
      <div className={styles.manageRow}>
        <div className={styles.navGroup} role="group" aria-label="Navigation temporelle">
          <button
            type="button"
            className={styles.navBtn}
            onClick={onPrev}
            aria-label="Période précédente"
          >
            ‹
          </button>
          <button type="button" className={styles.todayBtn} onClick={onToday}>
            Aujourd’hui
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={onNext}
            aria-label="Période suivante"
          >
            ›
          </button>
        </div>

        <p className={styles.rangeLabel}>{rangeLabel}</p>

        <div className={styles.modeSwitch} role="tablist" aria-label="Zoom temporel">
          {(Object.keys(VIEW_MODE_LABELS) as PlanningViewMode[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              className={mode === key ? styles.modeActive : styles.modeBtn}
              onClick={() => onModeChange(key)}
            >
              {VIEW_MODE_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.legend} aria-label="Légende paiement">
        {(Object.keys(PAYMENT_STATUS_LABELS) as PlanningPaymentStatus[]).map((status) => (
          <span key={status} className={styles.legendItem}>
            <span
              className={styles.legendSwatch}
              style={{ background: PAYMENT_STATUS_COLORS[status] }}
            />
            {PAYMENT_STATUS_LABELS[status]}
          </span>
        ))}
        {loading ? <span className={styles.statusNote}>Chargement…</span> : null}
        {error ? <span className={styles.errorNote}>{error}</span> : null}
      </div>

      {buildings.length > 1 ? (
        <div className={styles.filtersRow}>
          <label className={styles.buildingFilter}>
            <span className={styles.buildingLabel}>Bâtiment</span>
            <select
              value={buildingId}
              onChange={(event) => {
                const value = event.target.value;
                onBuildingChange(value === "all" ? "all" : value);
              }}
            >
              <option value="all">Tous les bâtiments</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}
