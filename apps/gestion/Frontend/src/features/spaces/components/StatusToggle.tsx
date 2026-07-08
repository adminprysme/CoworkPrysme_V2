import type { BuildingStatus } from "../types.js";
import styles from "./StatusToggle.module.css";

interface StatusToggleProps {
  value: BuildingStatus;
  onChange: (status: BuildingStatus) => void;
  ariaLabel?: string;
}

const OPTIONS: BuildingStatus[] = ["active", "inactive"];

export function StatusToggle({ value, onChange, ariaLabel = "Statut" }: StatusToggleProps) {
  return (
    <div className={styles.toggle} role="group" aria-label={ariaLabel}>
      {OPTIONS.map((status) => (
        <button
          key={status}
          type="button"
          className={[
            styles.option,
            value === status ? styles.optionSelected : "",
            status === "inactive" && value === status ? styles.optionSelectedInactive : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={value === status}
          onClick={() => onChange(status)}
        >
          {status === "active" ? "Actif" : "Inactif"}
        </button>
      ))}
    </div>
  );
}
