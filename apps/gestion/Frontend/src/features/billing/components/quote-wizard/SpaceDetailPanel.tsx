import { useState } from "react";
import { IconBuilding, IconDoor, IconUsers } from "@tabler/icons-react";
import type { BuildingResponse, SpaceResponse, SpaceType } from "@coworkprysme/shared";

import { spacePrimaryPhotoUrl } from "../../../../pages/components/vitrine-catalog-photos.js";
import { isWizardSpaceSlotComplete } from "../../lib/quote-wizard-state.js";
import pageStyles from "../../BillingPages.module.css";
import { QuoteDurationRangeField } from "./QuoteDurationRangeField.js";
import styles from "./QuoteWizard.module.css";
import { SpaceAvailabilityPreview } from "./SpaceAvailabilityPreview.js";

const TYPE_FALLBACK_LABEL: Record<SpaceType, string> = {
  private_office: "Bureau",
  meeting_room: "Réunion",
};

type SpaceDetailPanelProps = {
  space: SpaceResponse;
  building: BuildingResponse | undefined;
  startLocal: string;
  endLocal: string;
  partySize: number;
  available?: boolean;
  availabilityReason?: string;
  checkingAvailability?: boolean;
  onPatch: (patch: { startLocal?: string; endLocal?: string; partySize?: number }) => void;
  onDeselect: () => void;
};

export function SpaceDetailPanel({
  space,
  building,
  startLocal,
  endLocal,
  partySize,
  available,
  availabilityReason,
  checkingAvailability = false,
  onPatch,
  onDeselect,
}: SpaceDetailPanelProps) {
  const photoUrl = spacePrimaryPhotoUrl(space.photos);
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = Boolean(photoUrl) && !imgFailed;
  const complete = isWizardSpaceSlotComplete({
    key: space.id,
    buildingId: space.buildingId,
    spaceId: space.id,
    spaceName: space.name,
    startLocal,
    endLocal,
    partySize,
    available,
    availabilityReason,
  });

  return (
    <aside className={styles.detailPanel} aria-label={`Configuration — ${space.name}`}>
      <div className={styles.detailBanner}>
        {showPhoto ? (
          <img
            className={styles.detailBannerImage}
            src={photoUrl!}
            alt=""
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className={styles.detailBannerFallback}
            data-space-type={space.type}
            aria-hidden="true"
          >
            <IconDoor size={22} stroke={1.5} />
            <span>{TYPE_FALLBACK_LABEL[space.type]}</span>
          </div>
        )}
      </div>

      <div className={styles.detailBody}>
        <div className={styles.detailHeader}>
          <h3 className={styles.detailTitle}>{space.name}</h3>
          <button type="button" className={pageStyles.secondaryButton} onClick={onDeselect}>
            Retirer
          </button>
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

        <QuoteDurationRangeField
          startLocal={startLocal}
          endLocal={endLocal}
          onChange={(next) => onPatch(next)}
        />

        <label className={pageStyles.label}>
          Nombre de personnes
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

        <SpaceAvailabilityPreview
          startLocal={startLocal}
          endLocal={endLocal}
          available={available}
          availabilityReason={availabilityReason}
          checking={checkingAvailability}
        />

        {!complete ? (
          <p className={styles.serviceIncompleteHint}>
            {!startLocal.trim() || !endLocal.trim()
              ? "Renseignez la durée pour finaliser la sélection."
              : available === false
                ? "Choisissez un créneau disponible pour finaliser la sélection."
                : checkingAvailability
                  ? "Vérification de la disponibilité en cours…"
                  : "Complétez la durée, le nombre de personnes et la disponibilité."}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
