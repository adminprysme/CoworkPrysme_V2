import { useState } from "react";

import { formatCentsAsEuroString } from "@coworkprysme/shared";

import type { Space } from "../space-types.js";
import { SPACE_TYPE_LABELS } from "../space-types.js";
import { formatTtcFromResponse } from "../utils/space-tariffs.js";
import { WEEK_DAY_LABELS, type WeekDay } from "../types.js";
import styles from "./SpaceDetailPanel.module.css";

type DetailTab = "info" | "pricing";

interface SpaceDetailPanelProps {
  space: Space | null;
  onEdit?: (space: Space) => void;
}

export function SpaceDetailPanel({ space, onEdit }: SpaceDetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>("info");

  if (!space) {
    return (
      <aside className={styles.panel} aria-label="Détail de l'espace">
        <p className={styles.placeholder}>
          Sélectionnez un espace dans la liste pour afficher son détail.
        </p>
      </aside>
    );
  }

  const mainPhoto = space.photos[0]?.previewUrl;

  return (
    <aside className={styles.panel} aria-label={`Détail de ${space.name}`}>
      <div className={styles.tabs} role="tablist" aria-label="Sections de l'espace">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "info"}
          className={[styles.tab, tab === "info" ? styles.tabActive : ""].filter(Boolean).join(" ")}
          onClick={() => setTab("info")}
        >
          Informations
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pricing"}
          className={[styles.tab, tab === "pricing" ? styles.tabActive : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setTab("pricing")}
        >
          Tarifs
        </button>
      </div>

      {tab === "info" ? (
        <div className={styles.body} role="tabpanel">
          {mainPhoto ? (
            <img src={mainPhoto} alt="" className={styles.heroPhoto} />
          ) : (
            <div className={styles.heroFallback}>Aucune photo</div>
          )}

          <div className={styles.headerRow}>
            <h2 className={styles.title}>{space.name}</h2>
            <div className={styles.headerActions}>
              {onEdit ? (
                <button type="button" className={styles.editBtn} onClick={() => onEdit(space)}>
                  Modifier
                </button>
              ) : null}
              <div className={styles.badges}>
                <span className={styles.badgeType}>{SPACE_TYPE_LABELS[space.type]}</span>
                <span
                  className={[
                    styles.badgeStatus,
                    space.status === "active" ? styles.badgeActive : styles.badgeInactive,
                  ].join(" ")}
                >
                  {space.status === "active" ? "Actif" : "Inactif"}
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
            <h3 className={styles.sectionTitle}>Horaires d&apos;ouverture</h3>
            <ul className={styles.scheduleList}>
              {space.openingHours.map((entry) => (
                <li key={entry.day}>
                  <span>{WEEK_DAY_LABELS[entry.day as WeekDay]}</span>
                  <span>{entry.is24h ? "24h/24" : `${entry.openTime} – ${entry.closeTime}`}</span>
                </li>
              ))}
            </ul>
          </section>

          {space.photos.length > 1 ? (
            <section>
              <h3 className={styles.sectionTitle}>Galerie</h3>
              <div className={styles.gallery}>
                {space.photos.map((photo) => (
                  <img
                    key={photo.id}
                    src={photo.previewUrl}
                    alt=""
                    className={styles.galleryThumb}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className={styles.body} role="tabpanel">
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
          {onEdit ? (
            <button type="button" className={styles.editBtn} onClick={() => onEdit(space)}>
              Modifier les tarifs
            </button>
          ) : null}
        </div>
      )}
    </aside>
  );
}
