import { useState } from "react";
import { IconBuilding, IconDoor, IconUsers } from "@tabler/icons-react";
import {
  DURATION_CLASS_LABELS,
  type BuildingResponse,
  type SpaceResponse,
  type SpaceType,
} from "@coworkprysme/shared";

import { spacePrimaryPhotoUrl } from "../../../../pages/components/vitrine-catalog-photos.js";
import { formatEuroFromCents } from "../../lib/quote-wizard-state.js";
import pageStyles from "../../BillingPages.module.css";
import styles from "./QuoteWizard.module.css";
import { SpaceAvailabilityPreview } from "./SpaceAvailabilityPreview.js";

const TYPE_FALLBACK_LABEL: Record<SpaceType, string> = {
  private_office: "Bureau",
  meeting_room: "Réunion",
};

type QuoteSpaceCardProps = {
  space: SpaceResponse;
  building: BuildingResponse | undefined;
  selected: boolean;
  startLocal: string;
  endLocal: string;
  partySize: number;
  available?: boolean;
  availabilityReason?: string;
  onSelect: () => void;
  onDeselect: () => void;
  onPatch: (patch: { startLocal?: string; endLocal?: string; partySize?: number }) => void;
};

function tariffLines(space: SpaceResponse): string[] {
  const preferred = ["hourly", "daily", "halfday", "weekly", "monthly"] as const;
  const byClass = new Map(space.tariffs.map((t) => [t.durationClass, t]));
  const lines: string[] = [];
  for (const durationClass of preferred) {
    const tariff = byClass.get(durationClass);
    if (!tariff) continue;
    lines.push(
      `${formatEuroFromCents(tariff.priceHT)} HT / ${DURATION_CLASS_LABELS[durationClass].toLowerCase()}`,
    );
    if (lines.length >= 2) break;
  }
  return lines;
}

export function QuoteSpaceCard({
  space,
  building,
  selected,
  startLocal,
  endLocal,
  partySize,
  available,
  availabilityReason,
  onSelect,
  onDeselect,
  onPatch,
}: QuoteSpaceCardProps) {
  const photoUrl = spacePrimaryPhotoUrl(space.photos);
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = Boolean(photoUrl) && !imgFailed;
  const prices = tariffLines(space);

  return (
    <article
      className={`${styles.catalogCard} ${selected ? styles.catalogCardSelected : ""}`}
      data-space-type={space.type}
    >
      <div className={styles.catalogMedia}>
        {showPhoto ? (
          <img
            className={styles.catalogMediaImage}
            src={photoUrl!}
            alt=""
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className={styles.catalogMediaFallback}
            data-space-type={space.type}
            aria-hidden="true"
          >
            <IconDoor size={28} stroke={1.5} />
            <span>{TYPE_FALLBACK_LABEL[space.type]}</span>
          </div>
        )}
        {selected ? <span className={styles.selectedBadge}>Sélectionné</span> : null}
      </div>

      <div className={styles.catalogBody}>
        <div className={styles.catalogTitleRow}>
          <h3 className={styles.catalogTitle}>{space.name}</h3>
        </div>
        <p className={styles.catalogMeta}>
          <IconBuilding size={14} stroke={1.75} aria-hidden="true" />
          <span>{building?.name ?? "Bâtiment"}</span>
        </p>
        <p className={styles.catalogMeta}>
          <IconUsers size={14} stroke={1.75} aria-hidden="true" />
          <span>
            {space.capacity} pers.
            {space.floor?.trim() ? ` · Étage ${space.floor.trim()}` : ""}
          </span>
        </p>
        {prices.length > 0 ? (
          <p className={styles.catalogPrice}>{prices.join(" · ")}</p>
        ) : (
          <p className={styles.catalogPriceMuted}>Tarif non configuré</p>
        )}

        <div className={styles.catalogActions}>
          {selected ? (
            <button type="button" className={pageStyles.secondaryButton} onClick={onDeselect}>
              Retirer
            </button>
          ) : (
            <button type="button" className={pageStyles.primaryButton} onClick={onSelect}>
              Sélectionner
            </button>
          )}
        </div>

        {selected ? (
          <div className={styles.selectedConfig}>
            <div className={styles.selectedFields}>
              <label className={pageStyles.label}>
                Début
                <input
                  className={pageStyles.input}
                  type="datetime-local"
                  value={startLocal}
                  onChange={(event) => onPatch({ startLocal: event.target.value })}
                />
              </label>
              <label className={pageStyles.label}>
                Fin
                <input
                  className={pageStyles.input}
                  type="datetime-local"
                  value={endLocal}
                  onChange={(event) => onPatch({ endLocal: event.target.value })}
                />
              </label>
              <label className={pageStyles.label}>
                Personnes
                <input
                  className={pageStyles.input}
                  type="number"
                  min={1}
                  max={space.capacity}
                  value={partySize}
                  onChange={(event) =>
                    onPatch({ partySize: Math.max(1, Number(event.target.value) || 1) })
                  }
                />
              </label>
            </div>
            <SpaceAvailabilityPreview
              startLocal={startLocal}
              endLocal={endLocal}
              available={available}
              availabilityReason={availabilityReason}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
