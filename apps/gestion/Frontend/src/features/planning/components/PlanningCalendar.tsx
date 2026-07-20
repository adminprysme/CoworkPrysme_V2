import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type {
  PlanningCalendarReservation,
  PlanningClosureBlock,
  PlanningSpaceRow,
  PlanningSpaceType,
  PlanningViewMode,
} from "@coworkprysme/shared";

import {
  PAYMENT_STATUS_COLORS,
  RESERVATION_LABEL_MIN_WIDTH_PX,
  blockGeometry,
  buildTimeColumns,
} from "../planning-utils.js";
import styles from "./PlanningCalendar.module.css";

const SPACE_TYPE_ORDER: PlanningSpaceType[] = ["private_office", "meeting_room"];
const SPACE_TYPE_LABELS: Record<PlanningSpaceType, string> = {
  private_office: "Bureaux privatifs",
  meeting_room: "Salles de réunion",
};

const COL_MIN_WIDTH: Record<PlanningViewMode, number> = {
  month: 40,
  week: 72,
  day: 48,
};

interface PlanningCalendarProps {
  mode: PlanningViewMode;
  from: Date;
  to: Date;
  spaces: PlanningSpaceRow[];
  reservations: PlanningCalendarReservation[];
  closures: PlanningClosureBlock[];
  selectedReservationId?: string | null;
  onReservationClick: (reservationId: string) => void;
  onSpaceNameClick: (spaceId: string) => void;
  onReservationHover?: (
    reservation: PlanningCalendarReservation | null,
    anchor: DOMRect | null,
  ) => void;
}

function reservationsForSpace(
  spaceId: string,
  reservations: PlanningCalendarReservation[],
): PlanningCalendarReservation[] {
  return reservations.filter((item) => item.spaceId === spaceId);
}

function closuresForSpace(
  space: PlanningSpaceRow,
  closures: PlanningClosureBlock[],
): PlanningClosureBlock[] {
  return closures.filter((closure) => {
    if (closure.spaceId) {
      return closure.spaceId === space.id;
    }
    if (closure.buildingId && closure.buildingId !== space.buildingId) {
      return false;
    }
    if (closure.spaceType && closure.spaceType !== space.type) {
      return false;
    }
    return Boolean(closure.buildingId || closure.spaceType);
  });
}

export function PlanningCalendar({
  mode,
  from,
  to,
  spaces,
  reservations,
  closures,
  selectedReservationId = null,
  onReservationClick,
  onSpaceNameClick,
  onReservationHover,
}: PlanningCalendarProps) {
  const columns = buildTimeColumns(from, to, mode);
  const rangeStartMs = from.getTime();
  const rangeEndMs = to.getTime();
  const colMin = COL_MIN_WIDTH[mode];
  const trackMinWidth = columns.length * colMin;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [trackWidthPx, setTrackWidthPx] = useState(0);

  useLayoutEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const measure = () => {
      const corner = root.querySelector(`.${styles.corner}`) as HTMLElement | null;
      const labelWidth = corner?.offsetWidth ?? 180;
      const available = Math.max(root.clientWidth - labelWidth, 0);
      setTrackWidthPx(Math.max(available, trackMinWidth));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [trackMinWidth, mode, columns.length]);

  const grouped = SPACE_TYPE_ORDER.map((type) => ({
    type,
    label: SPACE_TYPE_LABELS[type],
    spaces: spaces.filter((space) => space.type === type),
  })).filter((group) => group.spaces.length > 0);

  if (spaces.length === 0) {
    return <div className={styles.empty}>Aucun espace actif dans le périmètre sélectionné.</div>;
  }

  const cssVars = {
    ["--col-min-width"]: `${colMin}px`,
    ["--track-min-width"]: `${trackMinWidth}px`,
  } as CSSProperties;

  return (
    <div ref={scrollRef} className={styles.scroll} style={cssVars}>
      <div className={styles.grid}>
        <div className={styles.corner}>Espace</div>
        <div className={styles.headerTrack}>
          {columns.map((column) => (
            <div key={column.key} className={styles.headerCell}>
              {column.label}
            </div>
          ))}
        </div>

        {grouped.map((group) => (
          <div key={group.type} className={styles.group}>
            <div className={styles.groupLabel}>{group.label}</div>
            <div className={styles.groupTrackSpacer} />
            {group.spaces.map((space) => {
              const spaceReservations = reservationsForSpace(space.id, reservations);
              const spaceClosures = closuresForSpace(space, closures);
              return (
                <div key={space.id} className={styles.row}>
                  <button
                    type="button"
                    className={styles.spaceCell}
                    onClick={() => onSpaceNameClick(space.id)}
                    title={`Historique · ${space.name}`}
                  >
                    <span className={styles.spaceName}>{space.name}</span>
                    {space.floor ? (
                      <span className={styles.spaceMeta}>Étage {space.floor}</span>
                    ) : null}
                  </button>
                  <div className={styles.track}>
                    <div className={styles.trackBg}>
                      {columns.map((column) => (
                        <div key={column.key} className={styles.trackCell} />
                      ))}
                    </div>
                    <div className={styles.events}>
                      {spaceClosures
                        .filter((closure) => closure.kind === "closed")
                        .map((closure) => {
                          const geo = blockGeometry(
                            closure.startAt,
                            closure.endAt,
                            rangeStartMs,
                            rangeEndMs,
                          );
                          if (!geo) return null;
                          return (
                            <div
                              key={closure.id}
                              className={styles.closureBlock}
                              style={{ left: `${geo.leftPct}%`, width: `${geo.widthPct}%` }}
                              title={
                                closure.reason
                                  ? `Fermeture · ${closure.reason}`
                                  : "Fermeture exceptionnelle"
                              }
                            />
                          );
                        })}
                      {spaceReservations.map((reservation) => {
                        const geo = blockGeometry(
                          reservation.startAt,
                          reservation.endAt,
                          rangeStartMs,
                          rangeEndMs,
                        );
                        if (!geo) return null;
                        const blockWidthPx =
                          trackWidthPx > 0 ? (geo.widthPct / 100) * trackWidthPx : 0;
                        const showLabel = blockWidthPx >= RESERVATION_LABEL_MIN_WIDTH_PX;
                        const selected = selectedReservationId === reservation.id;
                        return (
                          <button
                            key={reservation.id}
                            type="button"
                            className={styles.eventBlock}
                            data-selected={selected ? "true" : undefined}
                            data-has-label={showLabel ? "true" : undefined}
                            style={{
                              left: `${geo.leftPct}%`,
                              width: `${geo.widthPct}%`,
                              background: PAYMENT_STATUS_COLORS[reservation.paymentStatus],
                            }}
                            aria-label={`${reservation.reference} · ${reservation.clientLabel}`}
                            onClick={() => onReservationClick(reservation.id)}
                            onMouseEnter={(event) => {
                              onReservationHover?.(
                                reservation,
                                event.currentTarget.getBoundingClientRect(),
                              );
                            }}
                            onMouseLeave={() => onReservationHover?.(null, null)}
                            onFocus={(event) => {
                              onReservationHover?.(
                                reservation,
                                event.currentTarget.getBoundingClientRect(),
                              );
                            }}
                            onBlur={() => onReservationHover?.(null, null)}
                          >
                            {showLabel ? (
                              <span className={styles.eventLabel}>
                                <span className={styles.eventClient}>
                                  {reservation.clientLabel}
                                </span>
                                <span className={styles.eventRef}>{reservation.reference}</span>
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
