import { useEffect, useId, useMemo, useState } from "react";
import type { PlanningHistoryEventType, PlanningSpaceHistoryResponse } from "@coworkprysme/shared";

import { fetchSpaceHistory } from "../../../lib/planning-api.js";
import { PAYMENT_STATUS_LABELS, formatDateTime } from "../planning-utils.js";
import styles from "./SpaceHistoryDrawer.module.css";

const TYPE_OPTIONS: Array<{ id: PlanningHistoryEventType; label: string }> = [
  { id: "reservation", label: "Réservations" },
  { id: "cancellation", label: "Annulations" },
  { id: "space_change", label: "Changements de salle" },
  { id: "closure", label: "Fermetures exceptionnelles" },
];

interface SpaceHistoryDrawerProps {
  spaceId: string;
  onClose: () => void;
  onOpenReservation?: (reservationId: string) => void;
}

export function SpaceHistoryDrawer({
  spaceId,
  onClose,
  onOpenReservation,
}: SpaceHistoryDrawerProps) {
  const titleId = useId();
  const [types, setTypes] = useState<PlanningHistoryEventType[]>(
    TYPE_OPTIONS.map((option) => option.id),
  );
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    date.setHours(0, 0, 0, 0);
    return date.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 3);
    date.setHours(0, 0, 0, 0);
    return date.toISOString().slice(0, 10);
  });
  const [data, setData] = useState<PlanningSpaceHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const typeKey = useMemo(() => types.slice().sort().join(","), [types]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const fromIso = new Date(`${from}T00:00:00`).toISOString();
    const toDate = new Date(`${to}T00:00:00`);
    toDate.setDate(toDate.getDate() + 1);
    void fetchSpaceHistory({
      spaceId,
      from: fromIso,
      to: toDate.toISOString(),
      types,
    })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erreur de chargement");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spaceId, from, to, typeKey, types]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggleType(type: PlanningHistoryEventType) {
    setTypes((current) => {
      if (current.includes(type)) {
        const next = current.filter((item) => item !== type);
        return next.length === 0 ? current : next;
      }
      return [...current, type];
    });
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Historique par espace</p>
            <h2 id={titleId} className={styles.title}>
              {data?.space.name ?? "…"}
            </h2>
            <p className={styles.meta}>Lecture seule · chronologique</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </header>

        <div className={styles.filters}>
          <label>
            Du
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            Au
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <div className={styles.typeFilters}>
            {TYPE_OPTIONS.map((option) => (
              <label key={option.id} className={styles.chip}>
                <input
                  type="checkbox"
                  checked={types.includes(option.id)}
                  onChange={() => toggleType(option.id)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <div className={styles.body}>
          {loading ? <p className={styles.muted}>Chargement…</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
          {!loading && data && data.events.length === 0 ? (
            <p className={styles.muted}>Aucun événement sur cette période.</p>
          ) : null}
          {!loading && data ? (
            <ol className={styles.timeline}>
              {data.events.map((event) => (
                <li key={event.id} className={styles.event}>
                  <div className={styles.eventHead}>
                    <span className={styles.eventType}>{labelForType(event.type)}</span>
                    <time dateTime={event.at}>{formatDateTime(event.at)}</time>
                  </div>
                  <strong className={styles.eventTitle}>{event.title}</strong>
                  {event.detail ? <p className={styles.eventDetail}>{event.detail}</p> : null}
                  {event.endAt ? (
                    <p className={styles.eventDetail}>Fin : {formatDateTime(event.endAt)}</p>
                  ) : null}
                  {event.paymentStatus ? (
                    <p className={styles.eventDetail}>
                      Paiement : {PAYMENT_STATUS_LABELS[event.paymentStatus]}
                    </p>
                  ) : null}
                  {event.reservationId && onOpenReservation ? (
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => onOpenReservation(event.reservationId!)}
                    >
                      Ouvrir la réservation
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function labelForType(type: PlanningHistoryEventType): string {
  return TYPE_OPTIONS.find((option) => option.id === type)?.label ?? type;
}
