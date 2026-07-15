import { useEffect, useMemo, useState } from "react";

import type { ServiceResponse } from "@coworkprysme/shared";
import { getFrozenServiceBuildingIds } from "@coworkprysme/shared";

import { fetchBuildings } from "../../../lib/buildings-api.js";
import type { AuthMeResponse } from "../../../lib/api.js";
import styles from "./ServiceAvailabilitySection.module.css";

export interface ServiceAvailabilityFormValue {
  isGlobal: boolean;
  buildingIds: string[];
}

interface BuildingOption {
  id: string;
  name: string;
  frozen: boolean;
}

interface ServiceAvailabilitySectionProps {
  value: ServiceAvailabilityFormValue;
  onChange: (value: ServiceAvailabilityFormValue) => void;
  user: AuthMeResponse;
  editing?: ServiceResponse;
  readOnly: boolean;
}

export function createDefaultAvailability(isAdmin: boolean): ServiceAvailabilityFormValue {
  return {
    isGlobal: isAdmin,
    buildingIds: [],
  };
}

export function ServiceAvailabilitySection({
  value,
  onChange,
  user,
  editing,
  readOnly,
}: ServiceAvailabilitySectionProps) {
  const isAdmin = user.profile.role === "admin";
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [loading, setLoading] = useState(true);

  const frozenIds = useMemo(() => {
    if (!editing || isAdmin || user.profile.scope.buildingIds.length === 0) {
      return new Set<string>();
    }
    return new Set(
      getFrozenServiceBuildingIds(
        {
          isGlobal: editing.isGlobal,
          buildingIds: editing.buildingIds,
        },
        {
          role: "manager",
          scopeBuildingIds: user.profile.scope.buildingIds,
        },
      ),
    );
  }, [editing, isAdmin, user.profile.scope.buildingIds]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchBuildings()
      .then((response) => {
        if (cancelled) {
          return;
        }
        setBuildings(
          response.buildings
            .filter((building) => building.status === "active")
            .map((building) => ({
              id: building.id,
              name: building.name,
              frozen: frozenIds.has(building.id),
            })),
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [frozenIds]);

  function setGlobalMode(isGlobal: boolean) {
    if (!isAdmin || readOnly) {
      return;
    }
    onChange({
      isGlobal,
      buildingIds: isGlobal ? [] : value.buildingIds,
    });
  }

  function toggleBuilding(buildingId: string) {
    if (readOnly || value.isGlobal || frozenIds.has(buildingId)) {
      return;
    }

    const selected = new Set(value.buildingIds);
    if (selected.has(buildingId)) {
      selected.delete(buildingId);
    } else {
      selected.add(buildingId);
    }

    onChange({
      ...value,
      buildingIds: [...selected],
    });
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h3>Disponibilité</h3>
        {readOnly ? (
          <span className={styles.readOnlyTag}>Prix seul</span>
        ) : value.isGlobal ? (
          <span className={styles.summaryTag}>Tous les bâtiments</span>
        ) : (
          <span className={styles.summaryTag}>
            {value.buildingIds.length} sélectionné{value.buildingIds.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {readOnly ? (
        <p className={styles.notice}>Ce service est global — seul le prix est modifiable.</p>
      ) : null}

      {isAdmin ? (
        <div className={styles.modeSwitch} role="group" aria-label="Mode de disponibilité">
          <button
            type="button"
            className={[styles.modeBtn, value.isGlobal ? styles.modeBtnActive : ""]
              .filter(Boolean)
              .join(" ")}
            disabled={readOnly}
            onClick={() => setGlobalMode(true)}
          >
            Global
          </button>
          <button
            type="button"
            className={[styles.modeBtn, !value.isGlobal ? styles.modeBtnActive : ""]
              .filter(Boolean)
              .join(" ")}
            disabled={readOnly}
            onClick={() => setGlobalMode(false)}
          >
            Par bâtiment
          </button>
        </div>
      ) : (
        <p className={styles.hint}>Seul un administrateur peut définir un service global.</p>
      )}

      {!value.isGlobal ? (
        <div className={styles.buildingsBlock}>
          {loading ? <p className={styles.hint}>Chargement…</p> : null}
          {!loading && buildings.length === 0 ? (
            <p className={styles.hint}>Aucun bâtiment disponible.</p>
          ) : null}
          <div className={styles.chipGrid}>
            {buildings.map((building) => {
              const checked = value.buildingIds.includes(building.id);
              const disabled = readOnly || building.frozen;
              return (
                <button
                  key={building.id}
                  type="button"
                  className={[
                    styles.chip,
                    checked ? styles.chipChecked : "",
                    disabled ? styles.chipDisabled : "",
                    building.frozen ? styles.chipFrozen : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={disabled}
                  title={building.frozen ? "Hors de votre périmètre" : undefined}
                  onClick={() => toggleBuilding(building.id)}
                >
                  <span>{building.name}</span>
                  {building.frozen ? <span className={styles.frozenMark}>⊘</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
