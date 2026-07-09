import { useEffect, useState } from "react";

import type { BuildingResponse, SpaceResponse } from "@coworkprysme/shared";

import { fetchBuildings } from "../../lib/buildings-api.js";
import { fetchSpacesByBuilding, updateSpace } from "../../lib/spaces-api.js";
import { spaceResponseToUpdateRequest } from "../../lib/spaces-mappers.js";
import styles from "./VitrineCatalogSpacesField.module.css";

interface BuildingSpaces {
  building: BuildingResponse;
  spaces: SpaceResponse[];
}

const SPACE_TYPE_LABEL: Record<SpaceResponse["type"], string> = {
  private_office: "Bureau privatif",
  meeting_room: "Salle de réunion",
};

export function VitrineCatalogSpacesField() {
  const [groups, setGroups] = useState<BuildingSpaces[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGroups() {
      setLoading(true);
      setLoadError(null);
      try {
        const { buildings } = await fetchBuildings();
        const entries = await Promise.all(
          buildings.map(async (building) => {
            const { spaces } = await fetchSpacesByBuilding(building.id);
            return {
              building,
              spaces: spaces.filter((space) => space.status === "active"),
            };
          }),
        );
        if (!cancelled) {
          setGroups(entries.filter((entry) => entry.spaces.length > 0));
        }
      } catch {
        if (!cancelled) {
          setLoadError("Impossible de charger les espaces.");
          setGroups([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadGroups();
    return () => {
      cancelled = true;
    };
  }, []);

  function replaceSpace(updated: SpaceResponse) {
    setGroups((current) =>
      current.map((group) => ({
        ...group,
        spaces: group.spaces.map((space) => (space.id === updated.id ? updated : space)),
      })),
    );
  }

  async function persistSpace(
    space: SpaceResponse,
    patch: Partial<Pick<SpaceResponse, "featuredOnVitrine" | "vitrineOrder">>,
  ) {
    setSavingId(space.id);
    setActionError(null);
    try {
      const updated = await updateSpace(
        space.id,
        spaceResponseToUpdateRequest({ ...space, ...patch }),
      );
      replaceSpace(updated);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Impossible d'enregistrer l'espace.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <p className={styles.hint}>Chargement des espaces actifs…</p>;
  }

  if (loadError) {
    return <p className={styles.error}>{loadError}</p>;
  }

  if (groups.length === 0) {
    return <p className={styles.empty}>Aucun espace actif à mettre en avant pour le moment.</p>;
  }

  return (
    <div className={styles.wrapper}>
      <p className={styles.intro}>
        Choix éditorial indépendant du statut catalogue : seuls les espaces <strong>actifs</strong>{" "}
        sont listés. L&apos;ordre numérique contrôle le tri sur les pages catalogue (plus petit =
        plus haut).
      </p>

      {actionError ? <p className={styles.error}>{actionError}</p> : null}

      {groups.map(({ building, spaces }) => (
        <section key={building.id} className={styles.buildingBlock}>
          <h3 className={styles.buildingTitle}>{building.name}</h3>
          <ul className={styles.spaceList}>
            {spaces.map((space) => {
              const isSaving = savingId === space.id;
              return (
                <li key={space.id} className={styles.spaceRow}>
                  <div>
                    <p className={styles.spaceName}>{space.name}</p>
                    <p className={styles.spaceMeta}>
                      {SPACE_TYPE_LABEL[space.type]} — {space.floor} — {space.capacity} pers.
                    </p>
                  </div>

                  <label className={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={space.featuredOnVitrine}
                      disabled={isSaving}
                      onChange={(event) =>
                        void persistSpace(space, { featuredOnVitrine: event.target.checked })
                      }
                    />
                    Mettre en avant
                  </label>

                  <label className={styles.orderField}>
                    Ordre
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={space.vitrineOrder ?? ""}
                      disabled={isSaving}
                      placeholder="—"
                      onChange={(event) => {
                        const raw = event.target.value.trim();
                        const nextOrder = raw === "" ? undefined : Number(raw);
                        replaceSpace({ ...space, vitrineOrder: nextOrder });
                      }}
                      onBlur={(event) => {
                        const raw = event.target.value.trim();
                        const nextOrder = raw === "" ? undefined : Number(raw);
                        if (nextOrder === space.vitrineOrder) {
                          return;
                        }
                        void persistSpace(space, { vitrineOrder: nextOrder });
                      }}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
