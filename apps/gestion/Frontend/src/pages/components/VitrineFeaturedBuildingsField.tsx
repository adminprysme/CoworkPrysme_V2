import { useEffect, useState } from "react";

import { VITRINE_FEATURED_BUILDINGS_MAX } from "@coworkprysme/shared";

import { fetchBuildings } from "../../lib/buildings-api.js";
import styles from "./VitrineFeaturedBuildingsField.module.css";

interface SelectableBuilding {
  id: string;
  name: string;
  city: string;
  status: string;
}

interface VitrineFeaturedBuildingsFieldProps {
  selectedIds: string[];
  saving: boolean;
  onSave: (buildingIds: string[]) => Promise<void>;
}

export function VitrineFeaturedBuildingsField({
  selectedIds,
  saving,
  onSave,
}: VitrineFeaturedBuildingsFieldProps) {
  const [buildings, setBuildings] = useState<SelectableBuilding[]>([]);
  const [selected, setSelected] = useState<string[]>(selectedIds);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(selectedIds);
  }, [selectedIds]);

  useEffect(() => {
    let cancelled = false;

    async function loadBuildings() {
      setLoading(true);
      setLoadError(null);
      try {
        const { buildings: items } = await fetchBuildings();
        if (!cancelled) {
          setBuildings(
            items
              .filter((building) => building.status === "active")
              .map((building) => ({
                id: building.id,
                name: building.name,
                city: building.address.city,
                status: building.status,
              })),
          );
        }
      } catch {
        if (!cancelled) {
          setLoadError("Impossible de charger la liste des bâtiments.");
          setBuildings([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadBuildings();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = selected.join(",") !== selectedIds.join(",");
  const buildingById = new Map(buildings.map((building) => [building.id, building]));

  function toggleBuilding(buildingId: string) {
    setSelected((current) => {
      if (current.includes(buildingId)) {
        return current.filter((id) => id !== buildingId);
      }
      if (current.length >= VITRINE_FEATURED_BUILDINGS_MAX) {
        return current;
      }
      return [...current, buildingId];
    });
  }

  function moveBuilding(buildingId: string, direction: -1 | 1) {
    setSelected((current) => {
      const index = current.indexOf(buildingId);
      if (index === -1) {
        return current;
      }
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item!);
      return next;
    });
  }

  return (
    <div className={styles.wrapper}>
      <p className={styles.intro}>
        Sélectionnez les bâtiments visibles sur la carte et dans l&apos;adresse du site vitrine. Le
        premier de la liste est affiché en priorité. Prépare l&apos;affichage multi-sites.
      </p>

      {loading ? <p className={styles.hint}>Chargement des bâtiments…</p> : null}
      {loadError ? <p className={styles.error}>{loadError}</p> : null}

      {!loading && !loadError && selected.length > 0 ? (
        <ol className={styles.selectedList}>
          {selected.map((buildingId, index) => {
            const building = buildingById.get(buildingId);
            if (!building) {
              return null;
            }
            return (
              <li key={buildingId} className={styles.selectedItem}>
                <span className={styles.order}>{index + 1}</span>
                <div className={styles.selectedBody}>
                  <strong>{building.name}</strong>
                  <span>{building.city}</span>
                </div>
                <div className={styles.selectedActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    disabled={saving || index === 0}
                    aria-label="Monter"
                    onClick={() => moveBuilding(buildingId, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    disabled={saving || index === selected.length - 1}
                    aria-label="Descendre"
                    onClick={() => moveBuilding(buildingId, 1)}
                  >
                    ↓
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      {!loading && !loadError ? (
        <ul className={styles.options}>
          {buildings.map((building) => {
            const checked = selected.includes(building.id);
            const disabled =
              saving || (!checked && selected.length >= VITRINE_FEATURED_BUILDINGS_MAX);
            return (
              <li key={building.id}>
                <label className={styles.option}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleBuilding(building.id)}
                  />
                  <span>
                    <strong>{building.name}</strong>
                    <span className={styles.optionMeta}>{building.city}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={saving || loading || !dirty}
          onClick={() => void onSave(selected)}
        >
          {saving ? "Enregistrement…" : "Enregistrer les bâtiments"}
        </button>
      </div>
    </div>
  );
}
