import { useEffect, useId, useRef, useState } from "react";
import { IconCheck, IconChevronDown, IconDoor } from "@tabler/icons-react";
import type {
  PlanningCancelPreview,
  PlanningCancelRefundMode,
  PlanningContactTransferPreview,
  PlanningDateChangeKind,
  PlanningDateChangePreview,
  PlanningManageSpaceOption,
  PlanningPartySizePreview,
  PlanningReservationDetail,
  PlanningRestorePreview,
  PlanningShortenRefundBasis,
  PlanningSpaceChangePreview,
  SuggestedRefundBasis,
} from "@coworkprysme/shared";
import { formatCentsAsEuroString, parseEuroInputToCents } from "@coworkprysme/shared";

import {
  confirmCancelReservation,
  confirmContactTransfer,
  confirmDateChange,
  confirmPartySize,
  confirmRestoreReservation,
  confirmSpaceChange,
  fetchCancelPreview,
  fetchContactTransferPreview,
  fetchDateChangePreview,
  fetchManageCandidateSpaces,
  fetchPartySizePreview,
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

const DATE_KIND_LABELS: Record<PlanningDateChangeKind, string> = {
  extend: "Agrandir le séjour",
  shorten: "Raccourcir le séjour",
  shift: "Reporter le créneau",
};

const SHORTEN_BASIS_LABELS: Record<PlanningShortenRefundBasis, string> = {
  cgv_scale: "Réservation non démarrée : barème CGV (CDC §3.10) appliqué à la portion retirée.",
  prorata_removed: "Séjour déjà commencé : remboursement au prorata de la portion retirée.",
  ended: "La réservation est terminée : aucun remboursement n'est suggéré.",
  unpaid: "Aucun paiement n'a été enregistré : aucun remboursement à effectuer.",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** datetime-local value from ISO (browser local timezone). */
function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** ISO UTC from datetime-local value. */
function fromDatetimeLocalValue(local: string): string | null {
  if (!local.trim()) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function contactLabel(contact: { firstName?: string; lastName?: string; email: string }): string {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  return name ? `${name} (${contact.email})` : contact.email;
}

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

  /** One modify/cancel accordion open at a time. */
  const [openAccordion, setOpenAccordion] = useState<
    "space" | "dates" | "party" | "transfer" | "cancel" | null
  >("space");
  /** When set, space-change list filters by min capacity (from party-size shortcut). */
  const [spaceMinCapacity, setSpaceMinCapacity] = useState<number | null>(null);

  // --- Date change ---
  const [dateStartLocal, setDateStartLocal] = useState(() => toDatetimeLocalValue(detail.startAt));
  const [dateEndLocal, setDateEndLocal] = useState(() => toDatetimeLocalValue(detail.endAt));
  const [datePreview, setDatePreview] = useState<PlanningDateChangePreview | null>(null);
  const [datePreviewLoading, setDatePreviewLoading] = useState(false);
  const [datePreviewError, setDatePreviewError] = useState<string | null>(null);
  const [dateBillDifference, setDateBillDifference] = useState(true);
  const [dateSkipBillingReason, setDateSkipBillingReason] = useState("");
  const [dateAcknowledgePriceGap, setDateAcknowledgePriceGap] = useState(false);
  const [confirmLateChange, setConfirmLateChange] = useState(false);
  const [lateChangeReason, setLateChangeReason] = useState("");
  const [dateRefundMode, setDateRefundMode] = useState<PlanningCancelRefundMode>("suggested");
  const [dateCustomRefundInput, setDateCustomRefundInput] = useState("");
  const [dateRefundDeviationReason, setDateRefundDeviationReason] = useState("");
  const [dateConfirmRefund, setDateConfirmRefund] = useState(false);
  const [dateSubmitting, setDateSubmitting] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  // --- Party size ---
  const [partySizeInput, setPartySizeInput] = useState(String(detail.partySize));
  const [partyPreview, setPartyPreview] = useState<PlanningPartySizePreview | null>(null);
  const [partyPreviewLoading, setPartyPreviewLoading] = useState(false);
  const [partyPreviewError, setPartyPreviewError] = useState<string | null>(null);
  const [partyNote, setPartyNote] = useState("");
  const [partySubmitting, setPartySubmitting] = useState(false);
  const [partyError, setPartyError] = useState<string | null>(null);

  // --- Contact transfer ---
  const [transferContactId, setTransferContactId] = useState("");
  const [transferPreview, setTransferPreview] = useState<PlanningContactTransferPreview | null>(
    null,
  );
  const [transferPreviewLoading, setTransferPreviewLoading] = useState(false);
  const [transferPreviewError, setTransferPreviewError] = useState<string | null>(null);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  function toggleAccordion(id: "space" | "dates" | "party" | "transfer" | "cancel") {
    setOpenAccordion((current) => (current === id ? null : id));
  }

  function openSpaceChangeWithCapacityFilter(minCapacity: number) {
    setSpaceMinCapacity(minCapacity);
    setOpenAccordion("space");
  }

  useEffect(() => {
    setSelectedSpaceId("");
    setPreview(null);
    setPreviewError(null);
    setBillDifference(false);
    setAcknowledgePriceGap(false);
    setSpaceChangeError(null);
    setSpaceMinCapacity(null);
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
    setDateStartLocal(toDatetimeLocalValue(detail.startAt));
    setDateEndLocal(toDatetimeLocalValue(detail.endAt));
    setDatePreview(null);
    setDatePreviewError(null);
    setDateBillDifference(true);
    setDateSkipBillingReason("");
    setDateAcknowledgePriceGap(false);
    setConfirmLateChange(false);
    setLateChangeReason("");
    setDateRefundMode("suggested");
    setDateCustomRefundInput("");
    setDateRefundDeviationReason("");
    setDateConfirmRefund(false);
    setDateError(null);
    setPartySizeInput(String(detail.partySize));
    setPartyPreview(null);
    setPartyPreviewError(null);
    setPartyNote("");
    setPartyError(null);
    setTransferContactId("");
    setTransferPreview(null);
    setTransferPreviewError(null);
    setTransferError(null);
  }, [reservationId, detail.startAt, detail.endAt, detail.partySize]);

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

  // Preview date change when local inputs change (debounced).
  useEffect(() => {
    if (readOnly || openAccordion !== "dates") {
      return;
    }
    const startIso = fromDatetimeLocalValue(dateStartLocal);
    const endIso = fromDatetimeLocalValue(dateEndLocal);
    if (!startIso || !endIso) {
      setDatePreview(null);
      setDatePreviewError("Saisissez des dates de début et de fin valides.");
      return;
    }
    if (startIso === detail.startAt && endIso === detail.endAt) {
      setDatePreview(null);
      setDatePreviewError(null);
      return;
    }
    let cancelled = false;
    setDatePreviewLoading(true);
    setDatePreviewError(null);
    const timer = window.setTimeout(() => {
      void fetchDateChangePreview(reservationId, startIso, endIso)
        .then((data) => {
          if (cancelled) return;
          setDatePreview(data);
          setDateBillDifference(data.complementTTC > 0);
          setDateCustomRefundInput(
            formatCentsAsEuroString(data.suggestedRefundCents).replace(".", ","),
          );
          setDateRefundMode("suggested");
          setDateConfirmRefund(false);
          setDateAcknowledgePriceGap(false);
          setConfirmLateChange(false);
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setDatePreview(null);
            setDatePreviewError(errorMessage(err));
          }
        })
        .finally(() => {
          if (!cancelled) setDatePreviewLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    reservationId,
    readOnly,
    openAccordion,
    dateStartLocal,
    dateEndLocal,
    detail.startAt,
    detail.endAt,
  ]);

  useEffect(() => {
    if (readOnly || openAccordion !== "party") {
      return;
    }
    const parsed = Number.parseInt(partySizeInput, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setPartyPreview(null);
      setPartyPreviewError(null);
      return;
    }
    if (parsed === detail.partySize) {
      setPartyPreview(null);
      setPartyPreviewError(null);
      return;
    }
    let cancelled = false;
    setPartyPreviewLoading(true);
    setPartyPreviewError(null);
    const timer = window.setTimeout(() => {
      void fetchPartySizePreview(reservationId, parsed)
        .then((data) => {
          if (!cancelled) setPartyPreview(data);
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setPartyPreview(null);
            setPartyPreviewError(errorMessage(err));
          }
        })
        .finally(() => {
          if (!cancelled) setPartyPreviewLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [reservationId, readOnly, openAccordion, partySizeInput, detail.partySize]);

  useEffect(() => {
    if (readOnly || openAccordion !== "transfer" || !transferContactId) {
      setTransferPreview(null);
      return;
    }
    let cancelled = false;
    setTransferPreviewLoading(true);
    setTransferPreviewError(null);
    void fetchContactTransferPreview(reservationId, transferContactId)
      .then((data) => {
        if (!cancelled) setTransferPreview(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setTransferPreview(null);
          setTransferPreviewError(errorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) setTransferPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reservationId, readOnly, openAccordion, transferContactId]);

  function resolveDateAcceptedRefundCents(): number | null {
    if (!datePreview || datePreview.kind !== "shorten") {
      return null;
    }
    if (dateRefundMode === "suggested") {
      return datePreview.suggestedRefundCents;
    }
    if (dateRefundMode === "none") {
      return 0;
    }
    const parsed = parseEuroInputToCents(dateCustomRefundInput);
    if (parsed == null || parsed > datePreview.paidTotalCents) {
      return null;
    }
    return parsed;
  }

  async function submitDateChange() {
    const startIso = fromDatetimeLocalValue(dateStartLocal);
    const endIso = fromDatetimeLocalValue(dateEndLocal);
    if (!startIso || !endIso || !datePreview) {
      return;
    }
    setDateSubmitting(true);
    setDateError(null);
    try {
      const acceptedRefundCents =
        datePreview.kind === "shorten" ? resolveDateAcceptedRefundCents() : undefined;
      if (datePreview.kind === "shorten" && acceptedRefundCents == null) {
        setDateError("Montant de remboursement invalide");
        return;
      }
      await confirmDateChange(reservationId, {
        startAt: startIso,
        endAt: endIso,
        confirmLateChange: datePreview.within48h ? confirmLateChange : false,
        lateChangeReason:
          datePreview.within48h && confirmLateChange ? lateChangeReason.trim() : undefined,
        billDifference: datePreview.complementTTC > 0 ? dateBillDifference : false,
        skipBillingReason:
          datePreview.complementTTC > 0 && !dateBillDifference
            ? dateSkipBillingReason.trim()
            : undefined,
        acknowledgePriceGap: datePreview.complementTTC > 0 ? dateAcknowledgePriceGap : false,
        refundMode: datePreview.kind === "shorten" ? dateRefundMode : undefined,
        acceptedRefundCents:
          datePreview.kind === "shorten" ? (acceptedRefundCents ?? undefined) : undefined,
        refundDeviationReason:
          datePreview.kind === "shorten" && dateRefundMode !== "suggested"
            ? dateRefundDeviationReason.trim()
            : undefined,
        confirm: true,
      });
      onChanged();
    } catch (err) {
      setDateError(errorMessage(err));
    } finally {
      setDateSubmitting(false);
    }
  }

  async function submitPartySize() {
    const parsed = Number.parseInt(partySizeInput, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setPartyError("Saisissez un nombre de personnes valide");
      return;
    }
    if (partyPreview?.exceedsCapacity) {
      setPartyError("L'effectif dépasse la capacité — changez de salle d'abord.");
      return;
    }
    setPartySubmitting(true);
    setPartyError(null);
    try {
      await confirmPartySize(reservationId, {
        newPartySize: parsed,
        note: partyNote.trim() || undefined,
        confirm: true,
      });
      onChanged();
    } catch (err) {
      setPartyError(errorMessage(err));
    } finally {
      setPartySubmitting(false);
    }
  }

  async function submitContactTransfer() {
    if (!transferContactId || !transferPreview?.eligible) {
      return;
    }
    setTransferSubmitting(true);
    setTransferError(null);
    try {
      await confirmContactTransfer(reservationId, {
        nextClientAccountId: transferContactId,
        confirm: true,
      });
      onChanged();
    } catch (err) {
      setTransferError(errorMessage(err));
    } finally {
      setTransferSubmitting(false);
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

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Annuler ou restaurer</h2>

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
                    La réservation repassera au statut confirmé sur le même espace et le même
                    créneau. Un email de notification sera envoyé au client.
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
        </section>
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

  const filteredSpaces =
    spaceMinCapacity == null
      ? spaces
      : spaces.filter((space) => space.capacity == null || space.capacity >= spaceMinCapacity);

  const dateAcceptedRefundCents = resolveDateAcceptedRefundCents();
  const dateComplementGap = !!datePreview && datePreview.complementTTC > 0;
  const dateLateOk =
    !datePreview?.within48h || (confirmLateChange && lateChangeReason.trim().length >= 3);
  const dateBillingOk =
    !dateComplementGap ||
    (dateAcknowledgePriceGap && (dateBillDifference || dateSkipBillingReason.trim().length >= 3));
  const dateShortenOk =
    !datePreview ||
    datePreview.kind !== "shorten" ||
    (dateConfirmRefund &&
      dateAcceptedRefundCents != null &&
      (dateRefundMode === "suggested" || dateRefundDeviationReason.trim().length >= 3) &&
      (dateRefundMode !== "custom" ||
        (dateAcceptedRefundCents != null &&
          dateAcceptedRefundCents <= datePreview.paidTotalCents)));
  const canSubmitDateChange =
    !!datePreview &&
    datePreview.available &&
    !datePreviewLoading &&
    !dateSubmitting &&
    dateLateOk &&
    dateBillingOk &&
    dateShortenOk;

  const parsedPartySize = Number.parseInt(partySizeInput, 10);
  const canSubmitPartySize =
    Number.isInteger(parsedPartySize) &&
    parsedPartySize > 0 &&
    parsedPartySize !== detail.partySize &&
    !!partyPreview &&
    !partyPreview.exceedsCapacity &&
    !partyPreviewLoading &&
    !partySubmitting;

  const transferCandidates = detail.contacts.filter(
    (contact) => contact.id !== detail.clientAccountId,
  );
  const canSubmitTransfer =
    !!transferContactId &&
    !!transferPreview?.eligible &&
    !transferPreviewLoading &&
    !transferSubmitting;

  const dateRefundConfirmLabel =
    dateRefundMode === "none"
      ? "Je confirme l'absence de remboursement"
      : `Je confirme le remboursement suggéré de ${formatCentsEur(dateAcceptedRefundCents ?? 0)}`;

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Modifier la réservation</h2>
        <div className={styles.accordion}>
          <div className={styles.accordionItem}>
            <button
              type="button"
              className={styles.accordionTrigger}
              aria-expanded={openAccordion === "space"}
              onClick={() => toggleAccordion("space")}
            >
              <span className={styles.accordionTriggerLabel}>
                <strong>Changer de salle</strong>
                <span>Déplacer la réservation vers un autre espace du même type</span>
              </span>
              <IconChevronDown
                size={16}
                stroke={1.7}
                className={
                  openAccordion === "space" ? styles.accordionChevronOpen : styles.accordionChevron
                }
                aria-hidden
              />
            </button>
            {openAccordion === "space" ? (
              <div className={styles.accordionBody}>
                {spacesError ? <p className={styles.error}>{spacesError}</p> : null}
                {spacesLoading ? <p className={styles.muted}>Chargement des espaces…</p> : null}

                {spaceMinCapacity != null ? (
                  <p className={styles.basisNote}>
                    Filtre actif : espaces capables d&apos;accueillir au moins {spaceMinCapacity}{" "}
                    personne{spaceMinCapacity > 1 ? "s" : ""}.{" "}
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => setSpaceMinCapacity(null)}
                    >
                      Effacer le filtre
                    </button>
                  </p>
                ) : null}

                {!spacesLoading && !spacesError ? (
                  filteredSpaces.length === 0 ? (
                    <p className={styles.muted}>
                      {spaceMinCapacity != null
                        ? "Aucun espace disponible avec cette capacité dans votre périmètre."
                        : "Aucun autre espace disponible dans votre périmètre."}
                    </p>
                  ) : (
                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>Nouvel espace</span>
                      <ManageSpaceSelect
                        spaces={filteredSpaces}
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
                      {preview.conflictMessage ??
                        "Cet espace n'est plus disponible sur ce créneau."}
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
                  {spaceChangeSubmitting
                    ? "Changement en cours…"
                    : "Confirmer le changement de salle"}
                </button>
              </div>
            ) : null}
          </div>

          <div className={styles.accordionItem}>
            <button
              type="button"
              className={styles.accordionTrigger}
              aria-expanded={openAccordion === "dates"}
              onClick={() => toggleAccordion("dates")}
            >
              <span className={styles.accordionTriggerLabel}>
                <strong>Modifier les dates</strong>
                <span>Raccourcir, agrandir ou reporter le créneau</span>
              </span>
              <IconChevronDown
                size={16}
                stroke={1.7}
                className={
                  openAccordion === "dates" ? styles.accordionChevronOpen : styles.accordionChevron
                }
                aria-hidden
              />
            </button>
            {openAccordion === "dates" ? (
              <div className={styles.accordionBody}>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Nouvelle date de début</span>
                  <input
                    type="datetime-local"
                    className={styles.input}
                    value={dateStartLocal}
                    disabled={dateSubmitting}
                    onChange={(event) => setDateStartLocal(event.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Nouvelle date de fin</span>
                  <input
                    type="datetime-local"
                    className={styles.input}
                    value={dateEndLocal}
                    disabled={dateSubmitting}
                    onChange={(event) => setDateEndLocal(event.target.value)}
                  />
                </div>

                {datePreviewLoading ? (
                  <p className={styles.muted}>Calcul de l&apos;impact…</p>
                ) : null}
                {datePreviewError ? <p className={styles.error}>{datePreviewError}</p> : null}

                {datePreview && !datePreviewLoading ? (
                  !datePreview.available ? (
                    <div className={styles.restoreConflict}>
                      <p className={styles.error}>
                        {datePreview.conflictMessage ??
                          "Ce créneau n'est pas disponible sur cet espace."}
                      </p>
                      {datePreview.conflictingReservation && onOpenReservation ? (
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => onOpenReservation(datePreview.conflictingReservation!.id)}
                        >
                          Ouvrir {datePreview.conflictingReservation.reference}
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className={styles.previewBlock}>
                      <div className={styles.amountLine}>
                        <span>Type de modification</span>
                        <span>{DATE_KIND_LABELS[datePreview.kind]}</span>
                      </div>
                      <div className={styles.amountLine}>
                        <span>Créneau actuel</span>
                        <span>
                          {formatDateTime(datePreview.previousStartAt)} →{" "}
                          {formatDateTime(datePreview.previousEndAt)}
                        </span>
                      </div>
                      <div className={styles.amountLine}>
                        <span>Nouveau créneau</span>
                        <span>
                          {formatDateTime(datePreview.nextStartAt)} →{" "}
                          {formatDateTime(datePreview.nextEndAt)}
                        </span>
                      </div>
                      <div className={styles.amountLine}>
                        <span>Unités facturables</span>
                        <span>
                          {datePreview.previousUnits} → {datePreview.nextUnits}
                        </span>
                      </div>
                      <div className={styles.divider} />
                      <div className={styles.amountLine}>
                        <span>Espace TTC (avant)</span>
                        <span>{formatCentsEur(datePreview.previousSpaceTTC)}</span>
                      </div>
                      <div className={styles.amountLine}>
                        <span>Espace TTC (après)</span>
                        <span>{formatCentsEur(datePreview.nextSpaceTTC)}</span>
                      </div>

                      {datePreview.complementTTC > 0 ? (
                        <>
                          <div className={styles.ttcRow}>
                            <span>Complément à facturer</span>
                            <span className={styles.deltaPositive}>
                              +{formatCentsEur(datePreview.complementTTC)}
                            </span>
                          </div>
                          <label className={styles.checkboxRow}>
                            <input
                              type="checkbox"
                              checked={dateBillDifference}
                              onChange={(event) => {
                                setDateBillDifference(event.target.checked);
                                if (event.target.checked) {
                                  setDateSkipBillingReason("");
                                }
                              }}
                            />
                            <span>Facturer le complément sur la facture proforma</span>
                          </label>
                          {!dateBillDifference ? (
                            <label className={styles.field}>
                              <span className={styles.fieldLabel}>
                                Justification du geste commercial (obligatoire)
                              </span>
                              <textarea
                                className={styles.textarea}
                                value={dateSkipBillingReason}
                                onChange={(event) => setDateSkipBillingReason(event.target.value)}
                                placeholder="Motif tracé au cardex…"
                                rows={2}
                              />
                            </label>
                          ) : null}
                          <label className={styles.checkboxRow}>
                            <input
                              type="checkbox"
                              checked={dateAcknowledgePriceGap}
                              onChange={(event) => setDateAcknowledgePriceGap(event.target.checked)}
                            />
                            <span>Je confirme avoir pris connaissance de l&apos;écart de prix</span>
                          </label>
                        </>
                      ) : null}

                      {datePreview.kind === "shorten" ? (
                        <>
                          <div className={styles.ttcRow}>
                            <span>Remboursement suggéré</span>
                            <span className={styles.refundValue}>
                              {formatCentsEur(datePreview.suggestedRefundCents)}
                            </span>
                          </div>
                          {datePreview.refundBasis ? (
                            <p className={styles.basisNote}>
                              {SHORTEN_BASIS_LABELS[datePreview.refundBasis]}
                            </p>
                          ) : null}
                          <div
                            className={styles.modeRow}
                            role="radiogroup"
                            aria-label="Mode de remboursement"
                          >
                            <button
                              type="button"
                              role="radio"
                              aria-checked={dateRefundMode === "suggested"}
                              className={
                                dateRefundMode === "suggested"
                                  ? styles.modePillActive
                                  : styles.modePill
                              }
                              onClick={() => {
                                setDateRefundMode("suggested");
                                setDateConfirmRefund(false);
                                setDateRefundDeviationReason("");
                              }}
                            >
                              Suggéré ({formatCentsEur(datePreview.suggestedRefundCents)})
                            </button>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={dateRefundMode === "custom"}
                              className={
                                dateRefundMode === "custom"
                                  ? styles.modePillActive
                                  : styles.modePill
                              }
                              onClick={() => {
                                setDateRefundMode("custom");
                                setDateConfirmRefund(false);
                              }}
                            >
                              Montant libre
                            </button>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={dateRefundMode === "none"}
                              className={
                                dateRefundMode === "none" ? styles.modePillActive : styles.modePill
                              }
                              onClick={() => {
                                setDateRefundMode("none");
                                setDateConfirmRefund(false);
                              }}
                            >
                              Ne pas rembourser
                            </button>
                          </div>
                          {dateRefundMode === "custom" ? (
                            <label className={styles.field}>
                              <span className={styles.fieldLabel}>Montant à rembourser (€)</span>
                              <input
                                className={styles.input}
                                inputMode="decimal"
                                value={dateCustomRefundInput}
                                onChange={(event) => {
                                  setDateCustomRefundInput(event.target.value);
                                  setDateConfirmRefund(false);
                                }}
                                placeholder="0,00"
                              />
                            </label>
                          ) : null}
                          {dateRefundMode !== "suggested" ? (
                            <label className={styles.field}>
                              <span className={styles.fieldLabel}>
                                Pourquoi ce montant diffère du remboursement suggéré ?
                              </span>
                              <textarea
                                className={styles.textarea}
                                value={dateRefundDeviationReason}
                                onChange={(event) =>
                                  setDateRefundDeviationReason(event.target.value)
                                }
                                placeholder="Justification obligatoire pour le cardex…"
                                rows={2}
                              />
                            </label>
                          ) : null}
                          <label className={styles.checkboxRow}>
                            <input
                              type="checkbox"
                              checked={dateConfirmRefund}
                              onChange={(event) => setDateConfirmRefund(event.target.checked)}
                            />
                            <span>{dateRefundConfirmLabel}</span>
                          </label>
                        </>
                      ) : null}

                      {datePreview.within48h ? (
                        <>
                          <p className={styles.error}>
                            Attention : moins de 48h avant la date de début initiale. Cette
                            modification nécessite une confirmation explicite du staff.
                          </p>
                          <label className={styles.checkboxRow}>
                            <input
                              type="checkbox"
                              checked={confirmLateChange}
                              onChange={(event) => setConfirmLateChange(event.target.checked)}
                            />
                            <span>Je confirme malgré le délai de 48h non respecté</span>
                          </label>
                          {confirmLateChange ? (
                            <label className={styles.field}>
                              <span className={styles.fieldLabel}>Justification (obligatoire)</span>
                              <textarea
                                className={styles.textarea}
                                value={lateChangeReason}
                                onChange={(event) => setLateChangeReason(event.target.value)}
                                placeholder="Motif tracé au cardex…"
                                rows={2}
                              />
                            </label>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  )
                ) : null}

                {dateError ? <p className={styles.error}>{dateError}</p> : null}

                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={!canSubmitDateChange}
                  onClick={() => void submitDateChange()}
                >
                  {dateSubmitting
                    ? "Modification en cours…"
                    : "Confirmer la modification des dates"}
                </button>
              </div>
            ) : null}
          </div>

          <div className={styles.accordionItem}>
            <button
              type="button"
              className={styles.accordionTrigger}
              aria-expanded={openAccordion === "party"}
              onClick={() => toggleAccordion("party")}
            >
              <span className={styles.accordionTriggerLabel}>
                <strong>Modifier le nombre de personnes</strong>
                <span>Ajuster la capacité réservée sur cet espace</span>
              </span>
              <IconChevronDown
                size={16}
                stroke={1.7}
                className={
                  openAccordion === "party" ? styles.accordionChevronOpen : styles.accordionChevron
                }
                aria-hidden
              />
            </button>
            {openAccordion === "party" ? (
              <div className={styles.accordionBody}>
                <p className={styles.muted}>
                  Effectif actuel : {detail.partySize}
                  {detail.space.capacity != null
                    ? ` · capacité de l'espace : ${detail.space.capacity}`
                    : ""}
                </p>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Nouveau nombre de personnes</span>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    step={1}
                    value={partySizeInput}
                    disabled={partySubmitting}
                    onChange={(event) => setPartySizeInput(event.target.value)}
                  />
                </label>

                {partyPreviewLoading ? (
                  <p className={styles.muted}>Vérification de la capacité…</p>
                ) : null}
                {partyPreviewError ? <p className={styles.error}>{partyPreviewError}</p> : null}

                {partyPreview?.exceedsCapacity ? (
                  <div className={styles.restoreConflict}>
                    <p className={styles.error}>
                      L&apos;effectif demandé ({partyPreview.newPartySize}) dépasse la capacité de
                      l&apos;espace actuel
                      {partyPreview.capacity != null ? ` (${partyPreview.capacity})` : ""}. Passez
                      par « Changer de salle » pour trouver un espace adapté — ne changez pas
                      l&apos;effectif ici tant que l&apos;espace est trop petit.
                    </p>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => openSpaceChangeWithCapacityFilter(partyPreview.newPartySize)}
                    >
                      Ouvrir « Changer de salle » (filtre ≥ {partyPreview.newPartySize})
                    </button>
                  </div>
                ) : null}

                {partyPreview && !partyPreview.exceedsCapacity ? (
                  <p className={styles.basisNote}>
                    La capacité de l&apos;espace suffit. Le tarif actuel ne dépend pas du nombre de
                    personnes : aucun recalcul de prix.
                  </p>
                ) : null}

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Note (optionnelle)</span>
                  <textarea
                    className={styles.textarea}
                    value={partyNote}
                    onChange={(event) => setPartyNote(event.target.value)}
                    placeholder="Commentaire tracé au cardex…"
                    rows={2}
                  />
                </label>

                {partyError ? <p className={styles.error}>{partyError}</p> : null}

                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={!canSubmitPartySize}
                  onClick={() => void submitPartySize()}
                >
                  {partySubmitting ? "Mise à jour…" : "Confirmer le nombre de personnes"}
                </button>
              </div>
            ) : null}
          </div>

          <div className={styles.accordionItem}>
            <button
              type="button"
              className={styles.accordionTrigger}
              aria-expanded={openAccordion === "transfer"}
              onClick={() => toggleAccordion("transfer")}
            >
              <span className={styles.accordionTriggerLabel}>
                <strong>Transférer à un autre contact</strong>
                <span>Changer le contact principal sans modifier la facture</span>
              </span>
              <IconChevronDown
                size={16}
                stroke={1.7}
                className={
                  openAccordion === "transfer"
                    ? styles.accordionChevronOpen
                    : styles.accordionChevron
                }
                aria-hidden
              />
            </button>
            {openAccordion === "transfer" ? (
              <div className={styles.accordionBody}>
                <p className={styles.muted}>
                  Seuls les contacts déjà liés au même cardex / entreprise sont proposés (même
                  source que l&apos;onglet Contacts). Aucun impact sur le prix ni la facture. Un
                  email sera envoyé à l&apos;ancien et au nouveau contact.
                </p>

                {transferCandidates.length === 0 ? (
                  <p className={styles.muted}>
                    Aucun autre contact disponible sur ce dossier client.
                  </p>
                ) : (
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Nouveau contact principal</span>
                    <select
                      className={styles.input}
                      value={transferContactId}
                      disabled={transferSubmitting}
                      onChange={(event) => setTransferContactId(event.target.value)}
                    >
                      <option value="">Sélectionner un contact…</option>
                      {transferCandidates.map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contactLabel(contact)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {transferPreviewLoading ? <p className={styles.muted}>Vérification…</p> : null}
                {transferPreviewError ? (
                  <p className={styles.error}>{transferPreviewError}</p>
                ) : null}
                {transferPreview && !transferPreview.eligible ? (
                  <p className={styles.error}>
                    {transferPreview.reason ?? "Transfert non éligible."}
                  </p>
                ) : null}
                {transferPreview?.eligible && transferPreview.nextContact ? (
                  <p className={styles.basisNote}>
                    Transfert de{" "}
                    {transferPreview.currentContact
                      ? contactLabel(transferPreview.currentContact)
                      : "contact actuel"}{" "}
                    vers {contactLabel(transferPreview.nextContact)}.
                  </p>
                ) : null}

                {transferError ? <p className={styles.error}>{transferError}</p> : null}

                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={!canSubmitTransfer}
                  onClick={() => void submitContactTransfer()}
                >
                  {transferSubmitting ? "Transfert en cours…" : "Confirmer le transfert de contact"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Annuler ou restaurer</h2>
        <div className={styles.accordion}>
          <div className={styles.accordionItem}>
            <button
              type="button"
              className={styles.accordionTrigger}
              aria-expanded={openAccordion === "cancel"}
              onClick={() => toggleAccordion("cancel")}
            >
              <span className={styles.accordionTriggerLabel}>
                <strong>Annuler la réservation</strong>
                <span>Clôturer avec remboursement suggéré (barème / prorata)</span>
              </span>
              <IconChevronDown
                size={16}
                stroke={1.7}
                className={
                  openAccordion === "cancel" ? styles.accordionChevronOpen : styles.accordionChevron
                }
                aria-hidden
              />
            </button>
            {openAccordion === "cancel" ? (
              <div className={styles.accordionBody}>
                {cancelPreviewError ? <p className={styles.error}>{cancelPreviewError}</p> : null}
                {cancelPreviewLoading ? (
                  <p className={styles.muted}>Calcul du remboursement suggéré…</p>
                ) : null}

                {cancelPreview && !cancelPreviewLoading ? (
                  <div className={styles.previewBlock}>
                    <div className={styles.amountLine}>
                      <span>Créneau</span>
                      <span>
                        {formatDateTime(cancelPreview.startAt)} →{" "}
                        {formatDateTime(cancelPreview.endAt)}
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

                    <div
                      className={styles.modeRow}
                      role="radiogroup"
                      aria-label="Mode de remboursement"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={refundMode === "suggested"}
                        className={
                          refundMode === "suggested" ? styles.modePillActive : styles.modePill
                        }
                        onClick={() => onRefundModeChange("suggested")}
                      >
                        Suggéré ({formatCentsEur(cancelPreview.suggestedRefundCents)})
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={refundMode === "custom"}
                        className={
                          refundMode === "custom" ? styles.modePillActive : styles.modePill
                        }
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
                            Saisissez un montant valide (max.{" "}
                            {formatCentsEur(cancelPreview.paidTotalCents)}
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
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
