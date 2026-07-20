import { useEffect, useId, useRef, useState } from "react";
import { IconCheck, IconChevronDown, IconDoor } from "@tabler/icons-react";
import type {
  PlanningCancelPreview,
  PlanningCancelRefundMode,
  PlanningManageSpaceOption,
  PlanningReservationDetail,
  PlanningRestorePreview,
  PlanningSpaceChangePreview,
  SuggestedRefundBasis,
} from "@coworkprysme/shared";
import { formatCentsAsEuroString, parseEuroInputToCents } from "@coworkprysme/shared";

import {
  confirmCancelReservation,
  confirmRestoreReservation,
  confirmSpaceChange,
  fetchCancelPreview,
  fetchManageCandidateSpaces,
  fetchRestorePreview,
  fetchSpaceChangePreview,
} from "../../../lib/planning-api.js";
import { formatCentsEur, formatDateTime } from "../planning-utils.js";
import { SPACE_TYPE_LABELS } from "../planning-ui.js";
import styles from "./ReservationManagePanel.module.css";

const REFUND_BASIS_LABELS: Record<SuggestedRefundBasis, string> = {
  not_started: "La réservation n'a pas encore commencé : remboursement intégral suggéré.",
  in_progress: "La réservation est en cours : remboursement calculé au prorata du temps restant.",
  ended: "La réservation est terminée : aucun remboursement n'est suggéré.",
  unpaid: "Aucun paiement n'a été enregistré : aucun remboursement à effectuer.",
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Une erreur est survenue";
}

function spaceSubtitle(space: Pick<PlanningManageSpaceOption, "type" | "buildingName">): string {
  return `${SPACE_TYPE_LABELS[space.type]} · ${space.buildingName}`;
}

interface ManageSpaceSelectProps {
  spaces: PlanningManageSpaceOption[];
  value: string;
  onChange: (spaceId: string) => void;
  disabled?: boolean;
}

function ManageSpaceSelect({ spaces, value, onChange, disabled }: ManageSpaceSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = spaces.find((space) => space.id === value) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.spaceSelect} ref={rootRef}>
      <button
        type="button"
        className={styles.spaceSelectTrigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <IconDoor size={18} stroke={1.6} className={styles.spaceSelectIcon} aria-hidden />
        <span className={styles.spaceSelectText}>
          {selected ? (
            <>
              <strong>{selected.name}</strong>
              <span>{spaceSubtitle(selected)}</span>
            </>
          ) : (
            <>
              <strong className={styles.spaceSelectPlaceholder}>Sélectionner un espace…</strong>
              <span>Type · bâtiment</span>
            </>
          )}
        </span>
        <IconChevronDown
          size={16}
          stroke={1.7}
          className={open ? styles.spaceSelectChevronOpen : styles.spaceSelectChevron}
          aria-hidden
        />
      </button>

      {open ? (
        <ul id={listId} className={styles.spaceSelectList} role="listbox">
          {spaces.map((space) => {
            const isSelected = space.id === value;
            return (
              <li key={space.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={!space.available}
                  className={[
                    styles.spaceSelectOption,
                    isSelected ? styles.spaceSelectOptionSelected : "",
                    !space.available ? styles.spaceSelectOptionDisabled : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    if (!space.available) {
                      return;
                    }
                    onChange(space.id);
                    setOpen(false);
                  }}
                >
                  <IconDoor size={16} stroke={1.6} className={styles.spaceSelectIcon} aria-hidden />
                  <span className={styles.spaceSelectText}>
                    <strong>{space.name}</strong>
                    <span>
                      {spaceSubtitle(space)}
                      {!space.available ? " · indisponible" : ""}
                    </span>
                  </span>
                  {isSelected ? (
                    <IconCheck
                      size={16}
                      stroke={2}
                      className={styles.spaceSelectCheck}
                      aria-hidden
                    />
                  ) : (
                    <span className={styles.spaceSelectCheckSpacer} aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

interface ReservationManagePanelProps {
  reservationId: string;
  detail: PlanningReservationDetail;
  onChanged: () => void;
  onOpenReservation?: (reservationId: string) => void;
}

export function ReservationManagePanel({
  reservationId,
  detail,
  onChanged,
  onOpenReservation,
}: ReservationManagePanelProps) {
  const readOnly = detail.readOnly;
  const isCancelled = detail.status === "cancelled";

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

  const [cancelPreview, setCancelPreview] = useState<PlanningCancelPreview | null>(null);
  const [cancelPreviewLoading, setCancelPreviewLoading] = useState(false);
  const [cancelPreviewError, setCancelPreviewError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [refundMode, setRefundMode] = useState<PlanningCancelRefundMode>("suggested");
  const [customRefundInput, setCustomRefundInput] = useState("");
  const [refundDeviationReason, setRefundDeviationReason] = useState("");
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [restorePreview, setRestorePreview] = useState<PlanningRestorePreview | null>(null);
  const [restorePreviewLoading, setRestorePreviewLoading] = useState(false);
  const [restorePreviewError, setRestorePreviewError] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreSubmitting, setRestoreSubmitting] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSpaceId("");
    setPreview(null);
    setPreviewError(null);
    setBillDifference(false);
    setAcknowledgePriceGap(false);
    setSpaceChangeError(null);
    setRestorePreview(null);
    setRestorePreviewError(null);
    setConfirmRestore(false);
    setRestoreError(null);
    setCancelReason("");
    setRefundMode("suggested");
    setCustomRefundInput("");
    setRefundDeviationReason("");
    setConfirmRefund(false);
    setCancelError(null);
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

  useEffect(() => {
    if (readOnly) {
      return;
    }
    let cancelled = false;
    setCancelPreviewLoading(true);
    setCancelPreviewError(null);
    fetchCancelPreview(reservationId)
      .then((data) => {
        if (!cancelled) {
          setCancelPreview(data);
          setCustomRefundInput(
            formatCentsAsEuroString(data.suggestedRefundCents).replace(".", ","),
          );
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCancelPreviewError(errorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCancelPreviewLoading(false);
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

  function onRefundModeChange(mode: PlanningCancelRefundMode) {
    setRefundMode(mode);
    setConfirmRefund(false);
    setCancelError(null);
    if (mode === "suggested" || mode === "none") {
      setRefundDeviationReason("");
    }
    if (mode === "custom" && cancelPreview && !customRefundInput.trim()) {
      setCustomRefundInput(
        formatCentsAsEuroString(cancelPreview.suggestedRefundCents).replace(".", ","),
      );
    }
  }

  function resolveAcceptedRefundCents(): number | null {
    if (!cancelPreview) {
      return null;
    }
    if (refundMode === "suggested") {
      return cancelPreview.suggestedRefundCents;
    }
    if (refundMode === "none") {
      return 0;
    }
    const parsed = parseEuroInputToCents(customRefundInput);
    if (parsed == null) {
      return null;
    }
    if (parsed > cancelPreview.paidTotalCents) {
      return null;
    }
    return parsed;
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

  async function submitCancel() {
    if (!cancelPreview) {
      return;
    }
    const acceptedRefundCents = resolveAcceptedRefundCents();
    if (acceptedRefundCents == null) {
      setCancelError("Montant de remboursement invalide");
      return;
    }
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      await confirmCancelReservation(reservationId, {
        reason: cancelReason.trim(),
        confirmRefund,
        refundMode,
        acceptedRefundCents,
        refundDeviationReason:
          refundMode === "suggested" ? undefined : refundDeviationReason.trim(),
      });
      onChanged();
    } catch (err) {
      setCancelError(errorMessage(err));
    } finally {
      setCancelSubmitting(false);
    }
  }

  useEffect(() => {
    if (!isCancelled) {
      setRestorePreview(null);
      setRestorePreviewError(null);
      return;
    }
    let cancelled = false;
    setRestorePreviewLoading(true);
    setRestorePreviewError(null);
    void fetchRestorePreview(reservationId)
      .then((payload) => {
        if (!cancelled) setRestorePreview(payload);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRestorePreview(null);
          setRestorePreviewError(errorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) setRestorePreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reservationId, isCancelled, detail.status]);

  async function handleRestore() {
    if (!confirmRestore || restoreSubmitting) return;
    setRestoreSubmitting(true);
    setRestoreError(null);
    try {
      await confirmRestoreReservation(reservationId, { confirm: true });
      onChanged();
    } catch (err) {
      setRestoreError(errorMessage(err));
    } finally {
      setRestoreSubmitting(false);
    }
  }

  /*
   * Transverse rule: cancelled / completed / no_show ⇒ Manage is lecture pure.
   * Sole documented exception: a cancelled reservation may expose "Restaurer"
   * when refund-at-cancel was 0 (see restore preview). This is not a regression
   * of the read-only rule — all other manage actions stay hidden.
   */
  if (isCancelled) {
    const showRestoreAction = restorePreview?.refundEligible === true;
    const canSubmitRestore =
      !!restorePreview?.canRestore &&
      confirmRestore &&
      !restoreSubmitting &&
      !restorePreviewLoading;

    return (
      <div className={styles.panel}>
        <p className={styles.banner}>
          Réservation annulée — lecture seule. La restauration est la seule action encore possible
          lorsque aucun remboursement n&apos;a été enregistré à l&apos;annulation et que le créneau
          est libre.
        </p>

        {restorePreviewLoading ? (
          <p className={styles.muted}>Vérification de l&apos;éligibilité…</p>
        ) : null}
        {restorePreviewError ? <p className={styles.error}>{restorePreviewError}</p> : null}

        {showRestoreAction ? (
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Restaurer la réservation</h3>
            {restorePreview && !restorePreview.slotAvailable ? (
              <div className={styles.restoreConflict}>
                <p className={styles.error}>
                  Le créneau est actuellement occupé
                  {restorePreview.conflictingReservation
                    ? ` par ${restorePreview.conflictingReservation.reference} (${restorePreview.conflictingReservation.clientLabel})`
                    : ""}
                  . Déplacez ou annulez d&apos;abord la réservation conflictuelle avant de
                  restaurer.
                </p>
                {restorePreview.conflictingReservation && onOpenReservation ? (
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => onOpenReservation(restorePreview.conflictingReservation!.id)}
                  >
                    Ouvrir {restorePreview.conflictingReservation.reference}
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <p className={styles.muted}>
                  La réservation repassera au statut confirmé sur le même espace et le même créneau.
                  Un email de notification sera envoyé au client.
                </p>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={confirmRestore}
                    disabled={restoreSubmitting}
                    onChange={(event) => setConfirmRestore(event.target.checked)}
                  />
                  <span>Je confirme vouloir restaurer cette réservation</span>
                </label>
                {restoreError ? <p className={styles.error}>{restoreError}</p> : null}
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={!canSubmitRestore}
                  onClick={() => void handleRestore()}
                >
                  {restoreSubmitting ? "Restauration en cours…" : "Restaurer la réservation"}
                </button>
              </>
            )}
          </section>
        ) : null}
      </div>
    );
  }

  if (readOnly) {
    return (
      <div className={styles.panel}>
        <p className={styles.banner}>
          Cette réservation est en lecture seule (terminée ou no-show). Aucune action de gestion
          n&apos;est disponible.
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

  const acceptedRefundCents = resolveAcceptedRefundCents();
  const reasonValid = cancelReason.trim().length >= 3;
  const deviationValid = refundMode === "suggested" || refundDeviationReason.trim().length >= 3;
  const customAmountValid =
    refundMode !== "custom" ||
    (acceptedRefundCents != null &&
      cancelPreview != null &&
      acceptedRefundCents <= cancelPreview.paidTotalCents);
  const canSubmitCancel =
    !!cancelPreview &&
    reasonValid &&
    deviationValid &&
    customAmountValid &&
    acceptedRefundCents != null &&
    confirmRefund &&
    !cancelSubmitting &&
    !cancelPreviewLoading;

  const confirmLabel =
    refundMode === "none"
      ? "Je confirme l'absence de remboursement"
      : `Je confirme le remboursement de ${formatCentsEur(acceptedRefundCents ?? 0)}`;

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
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Nouvel espace</span>
              <ManageSpaceSelect
                spaces={spaces}
                value={selectedSpaceId}
                onChange={onSelectSpace}
                disabled={spaceChangeSubmitting}
              />
            </div>
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

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Annulation de la réservation</h3>

        {cancelPreviewError ? <p className={styles.error}>{cancelPreviewError}</p> : null}
        {cancelPreviewLoading ? (
          <p className={styles.muted}>Calcul du remboursement suggéré…</p>
        ) : null}

        {cancelPreview && !cancelPreviewLoading ? (
          <div className={styles.previewBlock}>
            <div className={styles.amountLine}>
              <span>Créneau</span>
              <span>
                {formatDateTime(cancelPreview.startAt)} → {formatDateTime(cancelPreview.endAt)}
              </span>
            </div>
            <div className={styles.amountLine}>
              <span>Montant réglé</span>
              <span>{formatCentsEur(cancelPreview.paidTotalCents)}</span>
            </div>
            <div className={styles.divider} />
            <div className={styles.ttcRow}>
              <span>Remboursement suggéré</span>
              <span className={styles.refundValue}>
                {formatCentsEur(cancelPreview.suggestedRefundCents)}
              </span>
            </div>
            <p className={styles.basisNote}>{REFUND_BASIS_LABELS[cancelPreview.basis]}</p>

            <div className={styles.modeRow} role="radiogroup" aria-label="Mode de remboursement">
              <button
                type="button"
                role="radio"
                aria-checked={refundMode === "suggested"}
                className={refundMode === "suggested" ? styles.modePillActive : styles.modePill}
                onClick={() => onRefundModeChange("suggested")}
              >
                Suggéré ({formatCentsEur(cancelPreview.suggestedRefundCents)})
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={refundMode === "custom"}
                className={refundMode === "custom" ? styles.modePillActive : styles.modePill}
                onClick={() => onRefundModeChange("custom")}
              >
                Montant libre
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={refundMode === "none"}
                className={refundMode === "none" ? styles.modePillActive : styles.modePill}
                onClick={() => onRefundModeChange("none")}
              >
                Ne pas rembourser
              </button>
            </div>

            {refundMode === "custom" ? (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Montant à rembourser (€)</span>
                <input
                  className={styles.input}
                  inputMode="decimal"
                  value={customRefundInput}
                  onChange={(event) => {
                    setCustomRefundInput(event.target.value);
                    setConfirmRefund(false);
                  }}
                  placeholder="0,00"
                />
                {acceptedRefundCents == null ? (
                  <span className={styles.fieldHintError}>
                    Saisissez un montant valide (max. {formatCentsEur(cancelPreview.paidTotalCents)}
                    ).
                  </span>
                ) : (
                  <span className={styles.fieldHint}>
                    Soit {formatCentsEur(acceptedRefundCents)} (plafonné au montant réglé).
                  </span>
                )}
              </label>
            ) : null}

            {refundMode !== "suggested" ? (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  Pourquoi ce montant diffère du remboursement suggéré ?
                </span>
                <textarea
                  className={styles.textarea}
                  value={refundDeviationReason}
                  onChange={(event) => setRefundDeviationReason(event.target.value)}
                  placeholder="Justification obligatoire pour le cardex…"
                  rows={2}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Motif de l'annulation</span>
          <textarea
            className={styles.textarea}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Expliquez la raison de cette annulation…"
            rows={3}
          />
        </label>

        {cancelPreview ? (
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={confirmRefund}
              onChange={(event) => setConfirmRefund(event.target.checked)}
            />
            <span>{confirmLabel}</span>
          </label>
        ) : null}

        {cancelError ? <p className={styles.error}>{cancelError}</p> : null}

        <button
          type="button"
          className={styles.dangerBtn}
          disabled={!canSubmitCancel}
          onClick={() => void submitCancel()}
        >
          {cancelSubmitting ? "Annulation en cours…" : "Annuler la réservation"}
        </button>
      </section>
    </div>
  );
}
