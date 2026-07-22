import { useEffect, useId, useMemo, useState } from "react";
import { IconCalendarOff, IconChevronDown } from "@tabler/icons-react";
import type {
  PlanningHistoryEvent,
  PlanningHistoryEventType,
  PlanningReservationStatus,
  PlanningSpaceHistoryResponse,
} from "@coworkprysme/shared";

import { fetchSpaceHistory } from "../../../lib/planning-api.js";
import { RESERVATION_STATUS_LABELS } from "../planning-ui.js";
import { formatDateTime } from "../planning-utils.js";
import styles from "./SpaceHistoryDrawer.module.css";

type RangePreset = "7d" | "30d" | "year" | "custom";

type HistoryListItem =
  | {
      kind: "reservation";
      key: string;
      reservationId: string;
      events: PlanningHistoryEvent[];
      latestAt: string;
    }
  | {
      kind: "standalone";
      key: string;
      event: PlanningHistoryEvent;
      latestAt: string;
    };

function isReservationLinkedEvent(type: PlanningHistoryEventType): boolean {
  return (
    type === "reservation" ||
    type === "cancellation" ||
    type === "space_change" ||
    type === "restoration" ||
    type === "date_change" ||
    type === "party_size_change" ||
    type === "contact_transfer" ||
    type === "refund"
  );
}

function eventPrimaryLabel(event: PlanningHistoryEvent): string {
  const client = event.clientLabel?.trim();
  if (client) return client;
  if (event.reservationReference && event.title === event.reservationReference) {
    return event.title;
  }
  return event.title;
}

function eventContextualDetail(event: PlanningHistoryEvent): string | null {
  if (!event.detail?.trim()) return null;
  if (event.type === "reservation") return null;
  if (/^statut\s/i.test(event.detail.trim())) return null;
  return event.detail;
}

function eventStartIso(event: PlanningHistoryEvent): string | null {
  if (event.startAt) return event.startAt;
  if (event.type === "reservation") return event.at;
  return null;
}

function groupHistoryEvents(events: PlanningHistoryEvent[]): HistoryListItem[] {
  const byReservation = new Map<string, PlanningHistoryEvent[]>();
  const standalone: PlanningHistoryEvent[] = [];

  for (const event of events) {
    if (event.reservationId) {
      const list = byReservation.get(event.reservationId) ?? [];
      list.push(event);
      byReservation.set(event.reservationId, list);
      continue;
    }
    standalone.push(event);
  }

  const items: HistoryListItem[] = [];

  for (const [reservationId, groupEvents] of byReservation) {
    const chronological = groupEvents
      .slice()
      .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    const latest = chronological[chronological.length - 1]!;
    items.push({
      kind: "reservation",
      key: reservationId,
      reservationId,
      events: chronological,
      latestAt: latest.at,
    });
  }

  for (const event of standalone) {
    items.push({
      kind: "standalone",
      key: event.id,
      event,
      latestAt: event.at,
    });
  }

  items.sort((a, b) => b.latestAt.localeCompare(a.latestAt) || a.key.localeCompare(b.key));
  return items;
}

function pickGroupSummary(events: PlanningHistoryEvent[]): {
  dossierLabel: string;
  reference: string | null;
  status: PlanningReservationStatus | null;
  startIso: string | null;
  endIso: string | null;
} {
  const newestFirst = events.slice().reverse();
  const withLabel = newestFirst.find((event) => eventPrimaryLabel(event).trim());
  const withRef = newestFirst.find((event) => event.reservationReference?.trim());
  const withStatus = newestFirst.find((event) => event.reservationStatus);
  const withDates = newestFirst.find((event) => event.startAt || event.endAt);

  return {
    dossierLabel: withLabel ? eventPrimaryLabel(withLabel) : "Réservation",
    reference: withRef?.reservationReference?.trim() || null,
    status: withStatus?.reservationStatus ?? null,
    startIso: withDates ? eventStartIso(withDates) : null,
    endIso: withDates?.endAt ?? null,
  };
}

function eventCountLabel(count: number): string {
  return count <= 1 ? `${count} événement` : `${count} événements`;
}

const RANGE_PRESETS: Array<{ id: RangePreset; label: string }> = [
  { id: "7d", label: "7 jours" },
  { id: "30d", label: "30 jours" },
  { id: "year", label: "Cette année" },
  { id: "custom", label: "Personnalisé" },
];

const TYPE_OPTIONS: Array<{
  id: PlanningHistoryEventType;
  label: string;
  singularLabel: string;
  tone:
    | "reservation"
    | "cancellation"
    | "spaceChange"
    | "restoration"
    | "dateChange"
    | "partySize"
    | "contactTransfer"
    | "refund"
    | "closure";
}> = [
  { id: "reservation", label: "Réservations", singularLabel: "Réservation", tone: "reservation" },
  { id: "cancellation", label: "Annulations", singularLabel: "Annulation", tone: "cancellation" },
  {
    id: "space_change",
    label: "Changements de salle",
    singularLabel: "Changement de salle",
    tone: "spaceChange",
  },
  { id: "restoration", label: "Restaurations", singularLabel: "Restauration", tone: "restoration" },
  {
    id: "date_change",
    label: "Dates",
    singularLabel: "Modification des dates",
    tone: "dateChange",
  },
  {
    id: "party_size_change",
    label: "Effectif",
    singularLabel: "Modification d’effectif",
    tone: "partySize",
  },
  {
    id: "contact_transfer",
    label: "Transferts",
    singularLabel: "Transfert de contact",
    tone: "contactTransfer",
  },
  { id: "refund", label: "Remboursements", singularLabel: "Remboursement", tone: "refund" },
  { id: "closure", label: "Fermetures", singularLabel: "Fermeture", tone: "closure" },
];

function toneClassName(tone: (typeof TYPE_OPTIONS)[number]["tone"]): string {
  switch (tone) {
    case "reservation":
      return styles.toneReservation ?? "";
    case "cancellation":
      return styles.toneCancellation ?? "";
    case "spaceChange":
      return styles.toneSpaceChange ?? "";
    case "restoration":
      return styles.toneRestoration ?? "";
    case "dateChange":
      return styles.toneDateChange ?? "";
    case "partySize":
      return styles.tonePartySize ?? "";
    case "contactTransfer":
      return styles.toneContactTransfer ?? "";
    case "refund":
      return styles.toneCancellation ?? "";
    case "closure":
      return styles.toneClosure ?? "";
  }
}

function toDateInputValue(date: Date): string {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const y = copy.getFullYear();
  const m = String(copy.getMonth() + 1).padStart(2, "0");
  const d = String(copy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function rangeForPreset(preset: Exclude<RangePreset, "custom">): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = toDateInputValue(today);

  if (preset === "7d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: toDateInputValue(from), to };
  }
  if (preset === "30d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { from: toDateInputValue(from), to };
  }
  const from = new Date(today.getFullYear(), 0, 1);
  return { from: toDateInputValue(from), to };
}

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
  const [rangePreset, setRangePreset] = useState<RangePreset>("30d");
  const initialRange = rangeForPreset("30d");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [data, setData] = useState<PlanningSpaceHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  const typeKey = useMemo(() => types.slice().sort().join(","), [types]);
  const spaceName = data?.space.name ?? "…";
  const groupedItems = useMemo(() => (data ? groupHistoryEvents(data.events) : []), [data]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExpandedKeys(new Set());
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

  function applyPreset(preset: RangePreset) {
    setRangePreset(preset);
    if (preset === "custom") return;
    const next = rangeForPreset(preset);
    setFrom(next.from);
    setTo(next.to);
  }

  function toggleType(type: PlanningHistoryEventType) {
    setTypes((current) => {
      if (current.includes(type)) {
        const next = current.filter((item) => item !== type);
        return next.length === 0 ? current : next;
      }
      return [...current, type];
    });
  }

  function toggleExpanded(key: string) {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderStandaloneEvent(event: PlanningHistoryEvent) {
    const option = TYPE_OPTIONS.find((item) => item.id === event.type);
    const toneClass = toneClassName(option?.tone ?? "reservation");
    const primaryLabel = eventPrimaryLabel(event);
    const showReference =
      Boolean(event.reservationReference) && event.reservationReference !== primaryLabel;
    const contextualDetail = eventContextualDetail(event);
    const startIso = eventStartIso(event);

    return (
      <li key={event.id} className={[styles.event, toneClass].join(" ")}>
        <span className={styles.eventDot} aria-hidden="true" />
        <div className={styles.eventContent}>
          {event.type === "closure" ? (
            <time className={styles.eventTime} dateTime={event.at}>
              {formatDateTime(event.at)}
            </time>
          ) : null}
          <strong className={styles.eventTitle}>{primaryLabel}</strong>
          <div className={styles.eventDetails}>
            {isReservationLinkedEvent(event.type) ? (
              <>
                {showReference ? (
                  <p className={styles.eventReference}>{event.reservationReference}</p>
                ) : null}
                {event.reservationStatus ? (
                  <p>
                    Statut :{" "}
                    {RESERVATION_STATUS_LABELS[event.reservationStatus] ?? event.reservationStatus}
                  </p>
                ) : null}
                {startIso ? <p>Début : {formatDateTime(startIso)}</p> : null}
                {event.endAt ? <p>Fin : {formatDateTime(event.endAt)}</p> : null}
                {contextualDetail ? <p>{contextualDetail}</p> : null}
              </>
            ) : (
              <>
                {event.detail ? <p>{event.detail}</p> : null}
                {event.endAt ? <p>Fin : {formatDateTime(event.endAt)}</p> : null}
              </>
            )}
          </div>
          {event.reservationId && onOpenReservation ? (
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => onOpenReservation(event.reservationId!)}
            >
              Ouvrir la réservation
            </button>
          ) : null}
        </div>
      </li>
    );
  }

  function renderNestedEvent(event: PlanningHistoryEvent) {
    const option = TYPE_OPTIONS.find((item) => item.id === event.type);
    const toneClass = toneClassName(option?.tone ?? "reservation");
    const typeLabel = option?.singularLabel ?? event.title;
    const contextualDetail = eventContextualDetail(event);

    return (
      <li key={event.id} className={[styles.nestedEvent, toneClass].join(" ")}>
        <span className={styles.eventDot} aria-hidden="true" />
        <div className={styles.eventContent}>
          <time className={styles.eventTime} dateTime={event.at}>
            {formatDateTime(event.at)}
          </time>
          <strong className={styles.nestedEventTitle}>{typeLabel}</strong>
          {contextualDetail ? (
            <div className={styles.eventDetails}>
              <p>{contextualDetail}</p>
            </div>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <aside className={styles.panel} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <p className={styles.breadcrumb} aria-label="Navigation du panneau">
            <span className={styles.breadcrumbPrimary}>{spaceName}</span>
            <span className={styles.breadcrumbSep} aria-hidden="true">
              /
            </span>
            <span className={styles.breadcrumbMode}>Historique</span>
          </p>
          <h2 id={titleId} className={styles.title}>
            Historique
          </h2>
          <p className={styles.meta}>Lecture seule · regroupé par réservation</p>
        </div>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Retour">
          <span className={styles.closeGlyph} aria-hidden="true">
            ×
          </span>
          <span className={styles.closeLabel}>Retour</span>
        </button>
      </header>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <span className={styles.filterGroupLabel} id="space-history-range-label">
            Période
          </span>
          <div
            className={styles.filterPills}
            role="group"
            aria-labelledby="space-history-range-label"
          >
            {RANGE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={[
                  styles.filterPill,
                  rangePreset === preset.id ? styles.filterPillActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={rangePreset === preset.id}
                onClick={() => applyPreset(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {rangePreset === "custom" ? (
          <div className={styles.customDates}>
            <label>
              Du
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label>
              Au
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
          </div>
        ) : null}

        <div className={styles.filterGroup}>
          <span className={styles.filterGroupLabel} id="space-history-types-label">
            Événements
          </span>
          <div
            className={styles.filterPills}
            role="group"
            aria-labelledby="space-history-types-label"
          >
            {TYPE_OPTIONS.map((option) => {
              const active = types.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className={[
                    styles.typePill,
                    toneClassName(option.tone),
                    active ? styles.typePillActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={active}
                  onClick={() => toggleType(option.id)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.body}>
        {loading ? <p className={styles.muted}>Chargement…</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
        {!loading && data && data.events.length === 0 ? (
          <div className={styles.empty}>
            <IconCalendarOff size={28} stroke={1.5} aria-hidden className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>Aucun événement sur cette période</p>
            <p className={styles.emptyHint}>
              Élargissez la plage de dates ou activez d&apos;autres types d&apos;événements.
            </p>
          </div>
        ) : null}
        {!loading && data && groupedItems.length > 0 ? (
          <ol className={styles.groupList}>
            {groupedItems.map((item) => {
              if (item.kind === "standalone") {
                return (
                  <li key={item.key} className={styles.groupListItem}>
                    <ol className={styles.timeline}>{renderStandaloneEvent(item.event)}</ol>
                  </li>
                );
              }

              const summary = pickGroupSummary(item.events);
              const expanded = expandedKeys.has(item.key);
              const panelId = `space-history-group-${item.key}`;
              const latestTone =
                TYPE_OPTIONS.find(
                  (option) => option.id === item.events[item.events.length - 1]?.type,
                )?.tone ?? "reservation";

              return (
                <li key={item.key} className={[styles.group, toneClassName(latestTone)].join(" ")}>
                  <div className={styles.groupHead}>
                    <button
                      type="button"
                      className={styles.groupDisclosure}
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => toggleExpanded(item.key)}
                    >
                      <span className={styles.groupDisclosureMain}>
                        <strong className={styles.groupTitle}>{summary.dossierLabel}</strong>
                        {summary.reference ? (
                          <span className={styles.groupReference}>{summary.reference}</span>
                        ) : null}
                        <span className={styles.groupMeta}>
                          {summary.status ? (
                            <span>
                              {RESERVATION_STATUS_LABELS[summary.status] ?? summary.status}
                            </span>
                          ) : null}
                          {summary.startIso ? (
                            <span>Début {formatDateTime(summary.startIso)}</span>
                          ) : null}
                          {summary.endIso ? (
                            <span>Fin {formatDateTime(summary.endIso)}</span>
                          ) : null}
                          <span className={styles.groupCount}>
                            {eventCountLabel(item.events.length)}
                          </span>
                        </span>
                      </span>
                      <IconChevronDown
                        size={18}
                        stroke={1.7}
                        aria-hidden
                        className={expanded ? styles.groupChevronOpen : styles.groupChevron}
                      />
                    </button>
                    {onOpenReservation ? (
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => onOpenReservation(item.reservationId)}
                      >
                        Ouvrir la réservation
                      </button>
                    ) : null}
                  </div>
                  {expanded ? (
                    <ol id={panelId} className={styles.nestedTimeline}>
                      {item.events.map((event) => renderNestedEvent(event))}
                    </ol>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </aside>
  );
}
