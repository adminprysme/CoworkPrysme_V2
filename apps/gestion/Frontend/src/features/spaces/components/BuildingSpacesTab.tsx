import { useCallback, useEffect, useState } from "react";

import { createSpace, fetchSpacesByBuilding } from "../../../lib/spaces-api.js";
import { formValuesToCreateRequest, spaceResponseToSpace } from "../../../lib/spaces-mappers.js";
import { persistSpacePhotos } from "../../../lib/spaces-photos.js";
import type { DaySchedule } from "../types.js";
import type { Space, SpaceFormValues, SpaceStatusFilter, SpaceTypeFilter } from "../space-types.js";
import { filterSpaces, SpaceCard, SpaceFilters } from "./SpaceCard.js";
import { SpaceDetailPanel } from "./SpaceDetailPanel.js";
import { SpaceFormPanel } from "./SpaceFormPanel.js";
import styles from "./BuildingSpacesTab.module.css";

interface BuildingSpacesTabProps {
  buildingId: string;
  buildingName: string;
  floorNames: string[];
  buildingHours: DaySchedule[];
}

export function BuildingSpacesTab({
  buildingId,
  buildingName,
  floorNames,
  buildingHours,
}: BuildingSpacesTabProps) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<SpaceTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<SpaceStatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const loadSpaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSpacesByBuilding(buildingId);
      const nextSpaces = response.spaces.map(spaceResponseToSpace);
      setSpaces(nextSpaces);
      setSelectedId((current) =>
        current && nextSpaces.some((space) => space.id === current)
          ? current
          : (nextSpaces[0]?.id ?? null),
      );
    } catch {
      setError("Impossible de charger les espaces.");
      setSpaces([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => {
    void loadSpaces();
  }, [loadSpaces]);

  const filteredSpaces = filterSpaces(spaces, typeFilter, statusFilter);
  const selectedSpace = filteredSpaces.find((space) => space.id === selectedId) ?? null;

  async function handleCreate(values: SpaceFormValues) {
    const created = await createSpace(buildingId, formValuesToCreateRequest(values));
    if (values.photos.length > 0) {
      await persistSpacePhotos(created.id, values.photos);
    }
    await loadSpaces();
    setSelectedId(created.id);
  }

  return (
    <div className={styles.tab}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Espaces de {buildingName}</h2>
          <p className={styles.subtitle}>
            {loading ? "Chargement…" : `${spaces.length} espace${spaces.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => setFormOpen(true)}>
          <span aria-hidden="true">＋</span> Nouvel espace
        </button>
      </header>

      {error ? <p className={styles.errorBanner}>{error}</p> : null}

      <SpaceFilters
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        onTypeChange={setTypeFilter}
        onStatusChange={setStatusFilter}
      />

      <div className={styles.layout}>
        <section className={styles.listPanel} aria-label="Liste des espaces">
          {loading ? (
            <p className={styles.emptyState}>Chargement des espaces…</p>
          ) : filteredSpaces.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Aucun espace ne correspond à vos filtres.</p>
              {spaces.length === 0 ? (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => setFormOpen(true)}
                >
                  ＋ Créer le premier espace
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    setTypeFilter("all");
                    setStatusFilter("all");
                  }}
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          ) : (
            <div className={styles.list}>
              {filteredSpaces.map((space) => (
                <SpaceCard
                  key={space.id}
                  space={space}
                  selected={space.id === selectedId}
                  onSelect={() => setSelectedId(space.id)}
                />
              ))}
            </div>
          )}
        </section>

        <SpaceDetailPanel space={selectedSpace} />
      </div>

      <SpaceFormPanel
        open={formOpen}
        floorNames={floorNames}
        buildingHours={buildingHours}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
