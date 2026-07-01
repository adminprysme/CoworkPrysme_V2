import { useMemo, useState } from "react";

import { createMockSpacesForBuilding } from "../mock-spaces.js";
import type { Space, SpaceFormValues, SpaceStatusFilter, SpaceTypeFilter } from "../space-types.js";
import { formValuesToSpace } from "../utils/space-validation.js";
import { filterSpaces, SpaceCard, SpaceFilters } from "./SpaceCard.js";
import { SpaceDetailPanel } from "./SpaceDetailPanel.js";
import { SpaceFormPanel } from "./SpaceFormPanel.js";
import styles from "./BuildingSpacesTab.module.css";

interface BuildingSpacesTabProps {
  buildingId: string;
  buildingName: string;
  floorNames: string[];
}

export function BuildingSpacesTab({
  buildingId,
  buildingName,
  floorNames,
}: BuildingSpacesTabProps) {
  const initialSpaces = useMemo(
    () => createMockSpacesForBuilding(buildingId, floorNames),
    [buildingId, floorNames],
  );

  const [spaces, setSpaces] = useState<Space[]>(initialSpaces);
  const [typeFilter, setTypeFilter] = useState<SpaceTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<SpaceStatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(initialSpaces[0]?.id ?? null);
  const [formOpen, setFormOpen] = useState(false);

  const filteredSpaces = filterSpaces(spaces, typeFilter, statusFilter);
  const selectedSpace = filteredSpaces.find((space) => space.id === selectedId) ?? null;

  function handleCreate(values: SpaceFormValues) {
    const created = formValuesToSpace(values, buildingId);
    setSpaces((current) => [...current, created]);
    setSelectedId(created.id);
  }

  return (
    <div className={styles.tab}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Espaces de {buildingName}</h2>
          <p className={styles.subtitle}>
            {spaces.length} espace{spaces.length > 1 ? "s" : ""} · aperçu mock (state local)
          </p>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => setFormOpen(true)}>
          <span aria-hidden="true">＋</span> Nouvel espace
        </button>
      </header>

      <SpaceFilters
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        onTypeChange={setTypeFilter}
        onStatusChange={setStatusFilter}
      />

      <div className={styles.layout}>
        <section className={styles.listPanel} aria-label="Liste des espaces">
          {filteredSpaces.length === 0 ? (
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
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
