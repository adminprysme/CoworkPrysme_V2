import { formatCentsAsEuroString } from "@coworkprysme/shared";

import type { Space } from "../space-types.js";
import { SPACE_TYPE_LABELS } from "../space-types.js";
import { isArchivedSpace, SPACE_STATUS_LABELS } from "../utils/space-status.js";
import { formatTtcFromResponse } from "../utils/space-tariffs.js";
import styles from "./SpaceDetailPanel.module.css";

interface SpaceDetailPanelProps {
  space: Space | null;
  embedded?: boolean;
  onEdit?: (space: Space) => void;
  onArchive?: (space: Space) => void;
  onRestore?: (space: Space) => void;
  restoring?: boolean;
}

function statusBadgeClass(status: Space["status"]): string {
  if (status === "active") {
    return styles.badgeActive ?? "";
  }
  if (status === "archived") {
    return styles.badgeArchived ?? "";
  }
  return styles.badgeInactive ?? "";
}

function formatArchivedDate(isoDate: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(isoDate));
}

export function SpaceDetailPanel({
  space,
  embedded = false,
  onEdit,
  onArchive,
  onRestore,
  restoring = false,
}: SpaceDetailPanelProps) {
  if (!space) {
    return (
      <aside
        className={[styles.panel, embedded ? styles.panelEmbedded : ""].filter(Boolean).join(" ")}
        aria-label="Détail de l'espace"
      >
        <p className={styles.placeholder}>
          Sélectionnez un espace dans la liste pour afficher son détail.
        </p>
      </aside>
    );
  }

  const mainPhoto = space.photos[0]?.previewUrl;
  const archived = isArchivedSpace(space.status);

  return (
    <aside
      className={[styles.panel, embedded ? styles.panelEmbedded : ""].filter(Boolean).join(" ")}
      aria-label={`Détail de ${space.name}`}
    >
      <div className={styles.body}>
        {archived ? (
          <p className={styles.archiveNotice}>
            Espace archivé — conservé pour l&apos;historique des réservations et la facturation.
            {space.archivedAt ? ` Archivé le ${formatArchivedDate(space.archivedAt)}.` : null}
          </p>
        ) : null}

        {mainPhoto ? (
          <img src={mainPhoto} alt="" className={styles.heroPhoto} />
        ) : (
          <div className={styles.heroFallback}>Aucune photo</div>
        )}

        <div className={styles.headerRow}>
          <h2 className={styles.title}>{space.name}</h2>
          <div className={styles.headerActions}>
            <div className={styles.actionButtons}>
              {!archived && onEdit ? (
                <button type="button" className={styles.editBtn} onClick={() => onEdit(space)}>
                  Modifier
                </button>
              ) : null}
              {!archived && onArchive ? (
                <button
                  type="button"
                  className={styles.archiveBtn}
                  onClick={() => onArchive(space)}
                >
                  Archiver
                </button>
              ) : null}
              {archived && onRestore ? (
                <button
                  type="button"
                  className={styles.restoreBtn}
                  disabled={restoring}
                  onClick={() => onRestore(space)}
                >
                  {restoring ? "Restauration…" : "Restaurer"}
                </button>
              ) : null}
            </div>
            <div className={styles.badges}>
              <span className={styles.badgeType}>{SPACE_TYPE_LABELS[space.type]}</span>
              <span className={[styles.badgeStatus, statusBadgeClass(space.status)].join(" ")}>
                {SPACE_STATUS_LABELS[space.status]}
              </span>
            </div>
          </div>
        </div>

        {space.description ? <p className={styles.description}>{space.description}</p> : null}

        <dl className={styles.metaList}>
          <div>
            <dt>Étage</dt>
            <dd>{space.floor}</dd>
          </div>
          <div>
            <dt>Capacité</dt>
            <dd>
              {space.capacity} {space.type === "private_office" ? "poste(s)" : "personne(s)"}
            </dd>
          </div>
          {space.accessCode ? (
            <div>
              <dt>Code d&apos;accès</dt>
              <dd>{space.accessCode}</dd>
            </div>
          ) : null}
        </dl>

        {space.equipments.length > 0 ? (
          <section>
            <h3 className={styles.sectionTitle}>Équipements</h3>
            <ul className={styles.equipmentList}>
              {space.equipments.map((equipment) => (
                <li key={equipment.key}>{equipment.label}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h3 className={styles.sectionTitle}>Tarifs</h3>
          {space.tariffs.length === 0 ? (
            <p className={styles.emptyTariffs}>Aucun tarif activé pour cet espace.</p>
          ) : (
            <table className={styles.tariffTable}>
              <thead>
                <tr>
                  <th scope="col">Durée</th>
                  <th scope="col">Prix HT</th>
                  <th scope="col">TVA</th>
                  <th scope="col">TTC indicatif</th>
                </tr>
              </thead>
              <tbody>
                {space.tariffs.map((tariff) => (
                  <tr key={tariff.durationClass}>
                    <td>{tariff.label}</td>
                    <td>{formatCentsAsEuroString(tariff.priceHT)} €</td>
                    <td>{tariff.vatRate} %</td>
                    <td>{formatTtcFromResponse(tariff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {space.photos.length > 1 ? (
          <section>
            <h3 className={styles.sectionTitle}>Galerie</h3>
            <div className={styles.gallery}>
              {space.photos.map((photo) => (
                <img key={photo.id} src={photo.previewUrl} alt="" className={styles.galleryThumb} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
