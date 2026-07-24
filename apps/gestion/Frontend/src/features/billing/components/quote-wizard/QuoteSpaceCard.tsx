import { useState, type MouseEvent } from "react";
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

const TYPE_FALLBACK_LABEL: Record<SpaceType, string> = {
  private_office: "Bureau",
  meeting_room: "Réunion",
};

type QuoteSpaceCardProps = {
  space: SpaceResponse;
  building: BuildingResponse | undefined;
  selected: boolean;
  focused?: boolean;
  /** When selected: duration + availability ready (mirrors Services `data-complete`). */
  complete?: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onFocus: () => void;
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
  focused = false,
  complete = true,
  onSelect,
  onDeselect,
  onFocus,
}: QuoteSpaceCardProps) {
  const photoUrl = spacePrimaryPhotoUrl(space.photos);
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = Boolean(photoUrl) && !imgFailed;
  const prices = tariffLines(space);

  function onCardClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) return;
    if (selected) {
      onFocus();
      return;
    }
    onSelect();
  }

  return (
    <article
      className={[
        styles.catalogCard,
        selected ? styles.catalogCardSelected : "",
        focused ? styles.catalogCardFocused : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-space-type={space.type}
      data-selected={selected ? "true" : "false"}
      data-focused={focused ? "true" : "false"}
      data-complete={complete ? "true" : "false"}
      onClick={onCardClick}
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
        {selected ? (
          <span className={styles.selectedBadge}>{complete ? "Sélectionné" : "À compléter"}</span>
        ) : null}
      </div>

      <div className={styles.catalogBody}>
        <h3 className={styles.catalogTitle}>{space.name}</h3>
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
            <button
              type="button"
              className={pageStyles.secondaryButton}
              onClick={(event) => {
                event.stopPropagation();
                onDeselect();
              }}
            >
              Retirer
            </button>
          ) : (
            <button
              type="button"
              className={pageStyles.primaryButton}
              onClick={(event) => {
                event.stopPropagation();
                onSelect();
              }}
            >
              Sélectionner
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
