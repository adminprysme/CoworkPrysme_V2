import { useEffect, useState } from "react";

import type { BuildingResponse } from "@coworkprysme/shared";

import { fetchBuildings, updateBuilding } from "../../lib/buildings-api.js";
import { buildingResponseToUpdateRequest } from "../../lib/buildings-mappers.js";
import styles from "./VitrineCatalogBuildingsField.module.css";

export function VitrineCatalogBuildingsField() {
  const [buildings, setBuildings] = useState<BuildingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBuildings() {
      setLoading(true);
      setLoadError(null);
      try {
        const { buildings: items } = await fetchBuildings();
        if (!cancelled) {
          setBuildings(items);
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

  async function persistBuilding(
    building: BuildingResponse,
    patch: Partial<Pick<BuildingResponse, "visibleOnVitrine" | "isDefaultVitrineBuilding">>,
  ) {
    setSavingId(building.id);
    setActionError(null);
    try {
      const updated = await updateBuilding(
        building.id,
        buildingResponseToUpdateRequest({ ...building, ...patch }),
      );
      setBuildings((current) =>
        current.map((item) => {
          if (item.id === updated.id) {
            return updated;
          }
          if (patch.isDefaultVitrineBuilding && updated.isDefaultVitrineBuilding) {
            return { ...item, isDefaultVitrineBuilding: false };
          }
          return item;
        }),
      );
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Impossible d'enregistrer ce bâtiment.",
      );
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <p className={styles.hint}>Chargement des bâtiments…</p>;
  }

  if (loadError) {
    return <p className={styles.error}>{loadError}</p>;
  }

  const defaultBuildingId =
    buildings.find((building) => building.isDefaultVitrineBuilding)?.id ?? "";

  return (
    <div className={styles.wrapper}>
      <p className={styles.intro}>
        Contrôle quels bâtiments apparaissent sur les pages catalogue{" "}
        <strong>/bureaux-privatifs</strong> et <strong>/salle-de-reunion</strong>. Un seul bâtiment
        peut être défini par défaut.
      </p>

      {actionError ? <p className={styles.error}>{actionError}</p> : null}

      <ul className={styles.list}>
        {buildings.map((building) => {
          const isInactive = building.status === "inactive";
          const isSaving = savingId === building.id;

          return (
            <li
              key={building.id}
              className={[styles.row, isInactive ? styles.rowInactive : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <div className={styles.rowHeader}>
                <div>
                  <p className={styles.buildingName}>{building.name}</p>
                  <p className={styles.buildingMeta}>
                    {building.address.city}
                    {isInactive ? " — inactif" : ""}
                  </p>
                </div>
                {isSaving ? <span className={styles.saving}>Enregistrement…</span> : null}
              </div>

              <div className={styles.controls}>
                <label className={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={building.visibleOnVitrine}
                    disabled={isInactive || isSaving}
                    onChange={(event) =>
                      void persistBuilding(building, {
                        visibleOnVitrine: event.target.checked,
                        isDefaultVitrineBuilding: event.target.checked
                          ? building.isDefaultVitrineBuilding
                          : false,
                      })
                    }
                  />
                  Visible sur la vitrine
                </label>

                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="vitrine-default-building"
                    checked={defaultBuildingId === building.id}
                    disabled={isInactive || !building.visibleOnVitrine || isSaving}
                    onChange={() =>
                      void persistBuilding(building, {
                        visibleOnVitrine: true,
                        isDefaultVitrineBuilding: true,
                      })
                    }
                  />
                  Bâtiment par défaut
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
