import { useCallback, useEffect, useState } from "react";

import {
  archiveSpace,
  createSpace,
  fetchSpace,
  fetchSpacesByBuilding,
  restoreSpace,
  updateSpace,
} from "../../../lib/spaces-api.js";
import {
  formValuesToCreateRequest,
  spaceResponseToFormValues,
  spaceResponseToSpace,
} from "../../../lib/spaces-mappers.js";
import { persistSpacePhotos, removePersistedSpacePhoto } from "../../../lib/spaces-photos.js";
import type { DaySchedule } from "../types.js";
import type { Space, SpaceFormValues, SpaceStatusFilter, SpaceTypeFilter } from "../space-types.js";
import { isArchivedSpace } from "../utils/space-status.js";
import { filterSpaces, SpaceCard, SpaceFilters } from "./SpaceCard.js";
import { SpaceArchiveDialog } from "./SpaceArchiveDialog.js";
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
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editFormValues, setEditFormValues] = useState<SpaceFormValues | null>(null);
  const [archivingSpace, setArchivingSpace] = useState<Space | null>(null);
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadSpaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSpacesByBuilding(buildingId, {
        includeArchived: statusFilter === "archived",
      });
      const nextSpaces = response.spaces.map(spaceResponseToSpace);
      setSpaces(nextSpaces);
      setSelectedId((current) =>
        current && nextSpaces.some((space) => space.id === current)
          ? current
          : (nextSpaces.find((space) => !isArchivedSpace(space.status))?.id ??
            nextSpaces[0]?.id ??
            null),
      );
    } catch {
      setError("Impossible de charger les espaces.");
      setSpaces([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [buildingId, statusFilter]);

  useEffect(() => {
    void loadSpaces();
  }, [loadSpaces]);

  const operationalCount = spaces.filter((space) => !isArchivedSpace(space.status)).length;
  const filteredSpaces = filterSpaces(spaces, typeFilter, statusFilter);
  const selectedSpace = filteredSpaces.find((space) => space.id === selectedId) ?? null;
  const editingSpace = spaces.find((space) => space.id === editingSpaceId) ?? null;

  async function handleCreate(values: SpaceFormValues) {
    const created = await createSpace(buildingId, formValuesToCreateRequest(values));
    if (values.photos.length > 0) {
      await persistSpacePhotos(created.id, values.photos);
    }
    await loadSpaces();
    setSelectedId(created.id);
  }

  async function handleUpdate(values: SpaceFormValues) {
    if (!editingSpaceId) {
      return;
    }
    await updateSpace(editingSpaceId, formValuesToCreateRequest(values));
    if (values.photos.length > 0) {
      await persistSpacePhotos(editingSpaceId, values.photos);
    }
    await loadSpaces();
    setSelectedId(editingSpaceId);
  }

  async function handleArchiveConfirm() {
    if (!archivingSpace) {
      return;
    }
    setArchiveSubmitting(true);
    setArchiveError(null);
    try {
      await archiveSpace(archivingSpace.id);
      setArchivingSpace(null);
      if (selectedId === archivingSpace.id) {
        setSelectedId(null);
      }
      if (statusFilter !== "archived") {
        setStatusFilter("all");
      }
      await loadSpaces();
    } catch (archiveFailure) {
      setArchiveError(
        archiveFailure instanceof Error
          ? archiveFailure.message
          : "Impossible d'archiver cet espace.",
      );
    } finally {
      setArchiveSubmitting(false);
    }
  }

  async function handleRestore(space: Space) {
    setRestoring(true);
    setError(null);
    try {
      await restoreSpace(space.id, "inactive");
      setStatusFilter("all");
      await loadSpaces();
      setSelectedId(space.id);
    } catch {
      setError("Impossible de restaurer cet espace.");
    } finally {
      setRestoring(false);
    }
  }

  function openEdit(space: Space) {
    if (isArchivedSpace(space.status)) {
      return;
    }
    void fetchSpace(space.id)
      .then((response) => {
        setEditFormValues(spaceResponseToFormValues(response, buildingHours));
        setEditingSpaceId(space.id);
      })
      .catch(() => {
        setError("Impossible de charger cet espace pour modification.");
      });
  }

  return (
    <div className={styles.tab}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Espaces de {buildingName}</h2>
          <p className={styles.subtitle}>
            {loading
              ? "Chargement…"
              : `${operationalCount} espace${operationalCount > 1 ? "s" : ""} actif${operationalCount > 1 ? "s" : ""}`}
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
              {operationalCount === 0 && statusFilter !== "archived" ? (
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

        <SpaceDetailPanel
          space={selectedSpace}
          onEdit={openEdit}
          onArchive={(space) => {
            setArchiveError(null);
            setArchivingSpace(space);
          }}
          onRestore={(space) => void handleRestore(space)}
          restoring={restoring}
        />
      </div>

      <SpaceFormPanel
        open={formOpen}
        mode="create"
        floorNames={floorNames}
        buildingHours={buildingHours}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
      />

      <SpaceFormPanel
        open={editingSpaceId !== null}
        mode="edit"
        title={editingSpace ? `Modifier ${editingSpace.name}` : "Modifier l'espace"}
        floorNames={floorNames}
        buildingHours={buildingHours}
        initialValues={editFormValues ?? undefined}
        onClose={() => {
          setEditingSpaceId(null);
          setEditFormValues(null);
        }}
        onSubmit={handleUpdate}
        onRemovePersistedPhoto={async (storageKey) => {
          if (!editingSpaceId) {
            return;
          }
          await removePersistedSpacePhoto(editingSpaceId, storageKey);
          await loadSpaces();
        }}
      />

      <SpaceArchiveDialog
        space={archivingSpace}
        open={archivingSpace !== null}
        submitting={archiveSubmitting}
        error={archiveError}
        onClose={() => {
          if (!archiveSubmitting) {
            setArchivingSpace(null);
            setArchiveError(null);
          }
        }}
        onConfirm={() => void handleArchiveConfirm()}
      />
    </div>
  );
}
