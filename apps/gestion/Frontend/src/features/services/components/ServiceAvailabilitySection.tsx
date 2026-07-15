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

  function toggleGlobal(checked: boolean) {
    if (!isAdmin || readOnly) {
      return;
    }
    onChange({
      isGlobal: checked,
      buildingIds: checked ? [] : value.buildingIds,
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
      <h3>Disponibilité</h3>

      {readOnly ? (
        <p className={styles.notice}>Ce service est global — seul le prix est modifiable ici.</p>
      ) : null}

      <div
        className={[
          styles.globalItem,
          value.isGlobal ? styles.itemChecked : "",
          !isAdmin || readOnly ? styles.itemDisabled : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <label className={styles.optionLabel}>
          <input
            type="checkbox"
            checked={value.isGlobal}
            disabled={!isAdmin || readOnly}
            onChange={(event) => toggleGlobal(event.target.checked)}
          />
          <span>Service global (disponible dans tous les bâtiments)</span>
        </label>
        {!isAdmin ? (
          <p className={styles.hint}>Seul un administrateur peut créer un service global.</p>
        ) : null}
      </div>

      {!value.isGlobal ? (
        <div className={styles.buildingsBlock}>
          <p className={styles.subtitle}>Bâtiments concernés</p>
          {loading ? <p className={styles.hint}>Chargement des bâtiments…</p> : null}
          {!loading && buildings.length === 0 ? (
            <p className={styles.hint}>Aucun bâtiment disponible dans votre périmètre.</p>
          ) : null}
          <div className={styles.grid}>
            {buildings.map((building) => {
              const checked = value.buildingIds.includes(building.id);
              const disabled = readOnly || building.frozen;
              return (
                <div
                  key={building.id}
                  className={[
                    styles.item,
                    checked ? styles.itemChecked : "",
                    disabled ? styles.itemDisabled : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title={building.frozen ? "Hors de votre périmètre" : undefined}
                >
                  <label className={styles.optionLabel}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleBuilding(building.id)}
                    />
                    <span>{building.name}</span>
                  </label>
                  {building.frozen ? (
                    <span className={styles.frozenTag}>Hors de votre périmètre</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
