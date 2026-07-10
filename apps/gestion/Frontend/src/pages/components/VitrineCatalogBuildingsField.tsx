import { useEffect, useState } from "react";

import type { BuildingResponse } from "@coworkprysme/shared";

import { fetchBuildings, updateBuilding } from "../../lib/buildings-api.js";
import { buildingResponseToUpdateRequest } from "../../lib/buildings-mappers.js";
import { buildingPrimaryPhotoUrl } from "./vitrine-catalog-photos.js";
import styles from "./VitrineCatalogBuildingsField.module.css";

function BuildingFallbackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path
        d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

      <ul className={styles.grid}>
        {buildings.map((building) => {
          const isInactive = building.status === "inactive";
          const isSaving = savingId === building.id;
          const isDefault = defaultBuildingId === building.id;
          const photoUrl = buildingPrimaryPhotoUrl(building.photos);
          const switchId = `building-visible-${building.id}`;
          const radioId = `building-default-${building.id}`;

          return (
            <li
              key={building.id}
              className={[
                styles.card,
                isDefault ? styles.cardDefault : "",
                isInactive ? styles.cardInactive : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className={styles.media}>
                {photoUrl ? (
                  <img src={photoUrl} alt="" className={styles.photo} />
                ) : (
                  <div className={styles.mediaFallback}>
                    <span className={styles.fallbackIcon}>
                      <BuildingFallbackIcon />
                    </span>
                    <span className={styles.fallbackLabel}>Bâtiment</span>
                  </div>
                )}

                {isDefault ? <span className={styles.defaultBadge}>Par défaut</span> : null}
                {isSaving ? <span className={styles.saving}>Enregistrement…</span> : null}

                <div className={styles.mediaCaption}>
                  <p className={styles.buildingName}>{building.name}</p>
                  <p className={styles.buildingMeta}>
                    {building.address.city}
                    {isInactive ? " — inactif" : ""}
                  </p>
                </div>
              </div>

              <div className={styles.footer}>
                <div className={styles.controlRow}>
                  <label className={styles.controlLabel} htmlFor={switchId}>
                    Visible sur la vitrine
                  </label>
                  <button
                    id={switchId}
                    type="button"
                    role="switch"
                    aria-checked={building.visibleOnVitrine}
                    className={[styles.switch, building.visibleOnVitrine ? styles.switchOn : ""]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={isInactive || isSaving}
                    onClick={() =>
                      void persistBuilding(building, {
                        visibleOnVitrine: !building.visibleOnVitrine,
                        isDefaultVitrineBuilding: building.visibleOnVitrine
                          ? building.isDefaultVitrineBuilding
                          : false,
                      })
                    }
                  >
                    <span className={styles.knob} aria-hidden="true" />
                  </button>
                </div>

                <div className={styles.controlRow}>
                  <label className={styles.controlLabel} htmlFor={radioId}>
                    Bâtiment par défaut
                  </label>
                  <label className={styles.radioOption}>
                    <input
                      id={radioId}
                      type="radio"
                      name="vitrine-default-building"
                      className={styles.radioInput}
                      checked={isDefault}
                      disabled={isInactive || !building.visibleOnVitrine || isSaving}
                      onChange={() =>
                        void persistBuilding(building, {
                          visibleOnVitrine: true,
                          isDefaultVitrineBuilding: true,
                        })
                      }
                    />
                    <span className={styles.radioVisual} aria-hidden="true" />
                  </label>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
