import { useCallback, useEffect, useState } from "react";

import { fetchArchivedSpacesByBuilding, purgeSpacePermanently } from "../../../lib/spaces-api.js";
import { spaceResponseToSpace } from "../../../lib/spaces-mappers.js";
import type { Space } from "../space-types.js";
import { SPACE_TYPE_LABELS } from "../space-types.js";
import styles from "./ArchivedSpacesDangerSection.module.css";

interface ArchivedSpacesDangerSectionProps {
  buildingId: string;
}

function formatArchivedDate(isoDate: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoDate));
}

export function ArchivedSpacesDangerSection({ buildingId }: ArchivedSpacesDangerSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmNames, setConfirmNames] = useState<Record<string, string>>({});
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const loadArchivedSpaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchArchivedSpacesByBuilding(buildingId);
      setSpaces(response.spaces.map(spaceResponseToSpace));
      setConfirmNames({});
      setRowErrors({});
      setLoaded(true);
    } catch {
      setError("Impossible de charger les espaces archivés.");
      setSpaces([]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => {
    if (expanded) {
      void loadArchivedSpaces();
    }
  }, [expanded, loadArchivedSpaces]);

  async function handlePurge(space: Space) {
    if (confirmNames[space.id]?.trim() !== space.name) {
      return;
    }

    setPurgingId(space.id);
    setRowErrors((current) => {
      const next = { ...current };
      delete next[space.id];
      return next;
    });

    try {
      await purgeSpacePermanently(space.id);
      setSpaces((current) => current.filter((entry) => entry.id !== space.id));
      setConfirmNames((current) => {
        const next = { ...current };
        delete next[space.id];
        return next;
      });
    } catch (purgeError) {
      setRowErrors((current) => ({
        ...current,
        [space.id]:
          purgeError instanceof Error ? purgeError.message : "Suppression définitive impossible.",
      }));
    } finally {
      setPurgingId(null);
    }
  }

  const countLabel =
    loaded && !loading ? `${spaces.length} espace${spaces.length > 1 ? "s" : ""}` : null;

  return (
    <section className={styles.section}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        aria-controls="archived-spaces-danger-panel"
        onClick={() => setExpanded((current) => !current)}
      >
        <span className={styles.toggleMain}>
          <span id="archived-spaces-danger-title" className={styles.title}>
            Espaces archivés
          </span>
          {countLabel ? <span className={styles.countBadge}>{countLabel}</span> : null}
        </span>
        <span
          className={[styles.chevron, expanded ? styles.chevronOpen : ""].filter(Boolean).join(" ")}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {expanded ? (
        <div
          id="archived-spaces-danger-panel"
          className={styles.panel}
          role="region"
          aria-labelledby="archived-spaces-danger-title"
        >
          <p className={styles.text}>
            Les espaces archivés sont conservés pour l&apos;historique. Vous pouvez les supprimer
            définitivement s&apos;ils ne sont référencés par aucune réservation.
          </p>

          {error ? <p className={styles.errorBanner}>{error}</p> : null}

          {loading ? (
            <p className={styles.emptyState}>Chargement des espaces archivés…</p>
          ) : spaces.length === 0 ? (
            <p className={styles.emptyState}>Aucun espace archivé pour ce bâtiment.</p>
          ) : (
            <ul className={styles.list}>
              {spaces.map((space) => {
                const canPurge = confirmNames[space.id]?.trim() === space.name;
                const isPurging = purgingId === space.id;

                return (
                  <li key={space.id} className={styles.item}>
                    <div className={styles.itemHeader}>
                      <div>
                        <h3 className={styles.itemTitle}>{space.name}</h3>
                        <p className={styles.itemMeta}>
                          {SPACE_TYPE_LABELS[space.type]} · {space.floor} · {space.capacity} pers.
                          {space.archivedAt
                            ? ` · Archivé le ${formatArchivedDate(space.archivedAt)}`
                            : null}
                        </p>
                      </div>
                    </div>

                    <label className={styles.confirmField} htmlFor={`purge-space-${space.id}`}>
                      <span className={styles.confirmLabel}>
                        Saisissez le nom de l&apos;espace pour confirmer la suppression définitive
                      </span>
                      <input
                        id={`purge-space-${space.id}`}
                        className={styles.confirmInput}
                        value={confirmNames[space.id] ?? ""}
                        placeholder={space.name}
                        disabled={isPurging}
                        onChange={(event) =>
                          setConfirmNames((current) => ({
                            ...current,
                            [space.id]: event.target.value,
                          }))
                        }
                      />
                    </label>

                    {rowErrors[space.id] ? (
                      <p className={styles.rowError}>{rowErrors[space.id]}</p>
                    ) : null}

                    <button
                      type="button"
                      className={styles.deleteBtn}
                      disabled={!canPurge || isPurging}
                      onClick={() => void handlePurge(space)}
                    >
                      {isPurging ? "Suppression…" : "Supprimer définitivement"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
