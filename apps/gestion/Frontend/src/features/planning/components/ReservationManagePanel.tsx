import { useEffect, useState } from "react";
import type {
  PlanningManageSpaceOption,
  PlanningReservationDetail,
  PlanningSpaceChangePreview,
} from "@coworkprysme/shared";

import {
  confirmSpaceChange,
  fetchManageCandidateSpaces,
  fetchSpaceChangePreview,
} from "../../../lib/planning-api.js";
import { formatCentsEur } from "../planning-utils.js";
import styles from "./ReservationManagePanel.module.css";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Une erreur est survenue";
}

interface ReservationManagePanelProps {
  reservationId: string;
  detail: PlanningReservationDetail;
  onChanged: () => void;
}

export function ReservationManagePanel({
  reservationId,
  detail,
  onChanged,
}: ReservationManagePanelProps) {
  const readOnly = detail.readOnly;

  const [spaces, setSpaces] = useState<PlanningManageSpaceOption[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [spacesError, setSpacesError] = useState<string | null>(null);

  const [selectedSpaceId, setSelectedSpaceId] = useState<string>("");
  const [preview, setPreview] = useState<PlanningSpaceChangePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [billDifference, setBillDifference] = useState(false);
  const [acknowledgePriceGap, setAcknowledgePriceGap] = useState(false);
  const [spaceChangeSubmitting, setSpaceChangeSubmitting] = useState(false);
  const [spaceChangeError, setSpaceChangeError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSpaceId("");
    setPreview(null);
    setPreviewError(null);
    setBillDifference(false);
    setAcknowledgePriceGap(false);
    setSpaceChangeError(null);
  }, [reservationId]);

  useEffect(() => {
    if (readOnly) {
      return;
    }
    let cancelled = false;
    setSpacesLoading(true);
    setSpacesError(null);
    fetchManageCandidateSpaces(reservationId)
      .then((data) => {
        if (!cancelled) {
          setSpaces(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSpacesError(errorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSpacesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reservationId, readOnly]);

  function onSelectSpace(spaceId: string) {
    setSelectedSpaceId(spaceId);
    setPreview(null);
    setPreviewError(null);
    setAcknowledgePriceGap(false);
    setSpaceChangeError(null);
    if (!spaceId) {
      return;
    }
    setPreviewLoading(true);
    fetchSpaceChangePreview(reservationId, spaceId)
      .then((data) => setPreview(data))
      .catch((err: unknown) => setPreviewError(errorMessage(err)))
      .finally(() => setPreviewLoading(false));
  }

  async function submitSpaceChange() {
    if (!preview || !selectedSpaceId) {
      return;
    }
    setSpaceChangeSubmitting(true);
    setSpaceChangeError(null);
    try {
      await confirmSpaceChange(reservationId, {
        nextSpaceId: selectedSpaceId,
        billDifference,
        acknowledgePriceGap,
      });
      setSelectedSpaceId("");
      setPreview(null);
      setBillDifference(false);
      setAcknowledgePriceGap(false);
      onChanged();
    } catch (err) {
      setSpaceChangeError(errorMessage(err));
    } finally {
      setSpaceChangeSubmitting(false);
    }
  }

  if (readOnly) {
    return (
      <div className={styles.panel}>
        <p className={styles.banner}>
          Cette réservation est en lecture seule (annulée, terminée ou no-show). Aucune action de
          gestion n'est disponible.
        </p>
      </div>
    );
  }

  const priceGapRequired = preview ? preview.deltaTTC !== 0 : false;
  const canSubmitSpaceChange =
    !!selectedSpaceId &&
    !!preview &&
    preview.available &&
    !previewLoading &&
    !spaceChangeSubmitting &&
    (!priceGapRequired || acknowledgePriceGap);

  return (
    <div className={styles.panel}>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Changement de salle</h3>

        {spacesError ? <p className={styles.error}>{spacesError}</p> : null}
        {spacesLoading ? <p className={styles.muted}>Chargement des espaces…</p> : null}

        {!spacesLoading && !spacesError ? (
          spaces.length === 0 ? (
            <p className={styles.muted}>Aucun autre espace disponible dans votre périmètre.</p>
          ) : (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Nouvel espace</span>
              <select
                className={styles.select}
                value={selectedSpaceId}
                onChange={(event) => onSelectSpace(event.target.value)}
              >
                <option value="">Sélectionner un espace…</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id} disabled={!space.available}>
                    {space.name} · {space.buildingName}
                    {!space.available ? " (indisponible)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )
        ) : null}

        {previewLoading ? <p className={styles.muted}>Calcul du nouveau tarif…</p> : null}
        {previewError ? <p className={styles.error}>{previewError}</p> : null}

        {preview && !previewLoading ? (
          !preview.available ? (
            <p className={styles.error}>
              {preview.conflictMessage ?? "Cet espace n'est plus disponible sur ce créneau."}
            </p>
          ) : (
            <div className={styles.previewBlock}>
              <div className={styles.amountLine}>
                <span>Montant actuel TTC</span>
                <span>{formatCentsEur(preview.previousPricing.totalTTC)}</span>
              </div>
              <div className={styles.amountLine}>
                <span>Nouveau montant TTC</span>
                <span>{formatCentsEur(preview.nextPricing.totalTTC)}</span>
              </div>
              <div className={styles.divider} />
              <div className={styles.ttcRow}>
                <span>Écart</span>
                <span
                  className={
                    preview.deltaTTC === 0
                      ? styles.deltaNeutral
                      : preview.deltaTTC > 0
                        ? styles.deltaPositive
                        : styles.deltaNegative
                  }
                >
                  {preview.deltaTTC > 0 ? "+" : ""}
                  {formatCentsEur(preview.deltaTTC)}
                </span>
              </div>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={billDifference}
                  onChange={(event) => setBillDifference(event.target.checked)}
                />
                <span>Faire payer la différence sur la facture proforma</span>
              </label>

              {priceGapRequired ? (
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={acknowledgePriceGap}
                    onChange={(event) => setAcknowledgePriceGap(event.target.checked)}
                  />
                  <span>Je confirme avoir pris connaissance de l'écart de prix</span>
                </label>
              ) : null}
            </div>
          )
        ) : null}

        {spaceChangeError ? <p className={styles.error}>{spaceChangeError}</p> : null}

        <button
          type="button"
          className={styles.primaryBtn}
          disabled={!canSubmitSpaceChange}
          onClick={() => void submitSpaceChange()}
        >
          {spaceChangeSubmitting ? "Changement en cours…" : "Confirmer le changement de salle"}
        </button>
      </section>
    </div>
  );
}
