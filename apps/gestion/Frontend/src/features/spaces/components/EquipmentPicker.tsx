import { useState } from "react";

import type { SpaceEquipment } from "../space-types.js";
import { PREDEFINED_EQUIPMENTS } from "../space-types.js";
import styles from "./EquipmentPicker.module.css";

interface EquipmentPickerProps {
  idPrefix: string;
  selected: SpaceEquipment[];
  onChange: (equipments: SpaceEquipment[]) => void;
}

export function EquipmentPicker({ idPrefix, selected, onChange }: EquipmentPickerProps) {
  const [customLabel, setCustomLabel] = useState("");
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set());
  const selectedKeys = new Set(selected.map((entry) => entry.key));

  const visiblePresets = PREDEFINED_EQUIPMENTS.filter(
    (equipment) => !hiddenKeys.has(equipment.key),
  );

  function hideEquipment(key: string) {
    setHiddenKeys((current) => new Set([...current, key]));
    onChange(selected.filter((entry) => entry.key !== key));
  }

  function togglePreset(equipment: SpaceEquipment) {
    if (selectedKeys.has(equipment.key)) {
      onChange(selected.filter((entry) => entry.key !== equipment.key));
      return;
    }
    onChange([...selected, equipment]);
  }

  function addCustomEquipment() {
    const label = customLabel.trim();
    if (!label) {
      return;
    }
    const key = `custom-${label.toLowerCase().replace(/\s+/g, "-")}`;
    if (selectedKeys.has(key)) {
      setCustomLabel("");
      return;
    }
    onChange([...selected, { key, label }]);
    setCustomLabel("");
  }

  function removeEquipment(key: string) {
    onChange(selected.filter((entry) => entry.key !== key));
  }

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Équipements</legend>

      {visiblePresets.length > 0 ? (
        <div className={styles.presetGrid}>
          {visiblePresets.map((equipment) => {
            const checked = selectedKeys.has(equipment.key);
            return (
              <div
                key={equipment.key}
                className={[styles.presetItem, checked ? styles.presetItemChecked : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                <label className={styles.presetLabel}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePreset(equipment)}
                  />
                  <span>{equipment.label}</span>
                </label>
                <button
                  type="button"
                  className={styles.hideBtn}
                  aria-label={`Masquer ${equipment.label}`}
                  onClick={() => hideEquipment(equipment.key)}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className={styles.emptyHint}>Tous les équipements prédéfinis ont été masqués.</p>
      )}

      <div className={styles.customRow}>
        <label className={styles.customLabel} htmlFor={`${idPrefix}-custom-equipment`}>
          Ajouter un équipement
        </label>
        <div className={styles.customInputRow}>
          <input
            id={`${idPrefix}-custom-equipment`}
            className={styles.customInput}
            value={customLabel}
            placeholder="Ex. Imprimante"
            onChange={(event) => setCustomLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomEquipment();
              }
            }}
          />
          <button type="button" className={styles.addBtn} onClick={addCustomEquipment}>
            Ajouter
          </button>
        </div>
      </div>

      {selected.length > 0 ? (
        <ul className={styles.selectedList} aria-label="Équipements sélectionnés">
          {selected.map((equipment) => (
            <li key={equipment.key}>
              <span>{equipment.label}</span>
              <button
                type="button"
                className={styles.removeBtn}
                aria-label={`Retirer ${equipment.label}`}
                onClick={() => removeEquipment(equipment.key)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}
