import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type UIEvent,
} from "react";
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
    spaceType?: PlanningSpaceType,
  ) => void;
  onReservationContextMenu?: (
    reservation: PlanningCalendarReservation,
    clientX: number,
    clientY: number,
  ) => void;
}

function reservationsForSpace(
  spaceId: string,
  reservations: PlanningCalendarReservation[],
): PlanningCalendarReservation[] {
  return reservations.filter((item) => item.spaceId === spaceId);
}

function intervalsOverlap(
  a: Pick<PlanningCalendarReservation, "startAt" | "endAt">,
  b: Pick<PlanningCalendarReservation, "startAt" | "endAt">,
): boolean {
  return (
    new Date(a.startAt).getTime() < new Date(b.endAt).getTime() &&
    new Date(a.endAt).getTime() > new Date(b.startAt).getTime()
  );
}

type EventLane = "full" | "top" | "bottom";

/** Stack cancelled under active when they share a slot; otherwise keep full height. */
function resolveEventLane(
  reservation: PlanningCalendarReservation,
  siblings: PlanningCalendarReservation[],
): EventLane {
  const cancelled = reservation.status === "cancelled";
  const overlapsOpposite = siblings.some((other) => {
    if (other.id === reservation.id) return false;
    if (cancelled === (other.status === "cancelled")) return false;
    return intervalsOverlap(reservation, other);
  });
  if (!overlapsOpposite) return "full";
  return cancelled ? "bottom" : "top";
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

function ReservationEventBlock({
  reservation,
  leftPct,
  widthPct,
  selected,
  lane,
  spaceType,
  onReservationClick,
  onReservationHover,
  onReservationContextMenu,
}: {
  reservation: PlanningCalendarReservation;
  leftPct: number;
  widthPct: number;
  selected: boolean;
  lane: EventLane;
  spaceType: PlanningSpaceType;
  onReservationClick: (reservationId: string) => void;
  onReservationHover?: (
    reservation: PlanningCalendarReservation | null,
    anchor: DOMRect | null,
    spaceType?: PlanningSpaceType,
  ) => void;
  onReservationContextMenu?: (
    reservation: PlanningCalendarReservation,
    clientX: number,
    clientY: number,
  ) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [showLabel, setShowLabel] = useState(false);
  const cancelled = reservation.status === "cancelled";

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setShowLabel(el.getBoundingClientRect().width >= RESERVATION_LABEL_MIN_WIDTH_PX);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [leftPct, widthPct, lane]);

  const clientLabel = cancelled ? `Annulée · ${reservation.clientLabel}` : reservation.clientLabel;

  return (
    <button
      ref={ref}
      type="button"
      className={[
        styles.eventBlock,
        cancelled ? styles.eventBlockCancelled : "",
        lane === "top" ? styles.eventLaneTop : "",
        lane === "bottom" ? styles.eventLaneBottom : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-selected={selected ? "true" : undefined}
      data-has-label={showLabel ? "true" : undefined}
      data-cancelled={cancelled ? "true" : undefined}
      style={{
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        background: cancelled ? undefined : PAYMENT_STATUS_COLORS[reservation.paymentStatus],
        zIndex: selected ? 2 : cancelled ? 0 : 1,
      }}
      aria-label={`${cancelled ? "Annulée · " : ""}${reservation.reference} · ${reservation.clientLabel}`}
      onClick={() => onReservationClick(reservation.id)}
      onContextMenu={(event) => {
        // Maj + clic droit : laisser le menu natif du navigateur (pas de preventDefault).
        if (event.shiftKey) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onReservationHover?.(null, null);
        onReservationContextMenu?.(reservation, event.clientX, event.clientY);
      }}
      onMouseEnter={(event) => {
        onReservationHover?.(reservation, event.currentTarget.getBoundingClientRect(), spaceType);
      }}
      onMouseLeave={() => onReservationHover?.(null, null)}
      onFocus={(event) => {
        onReservationHover?.(reservation, event.currentTarget.getBoundingClientRect(), spaceType);
      }}
      onBlur={() => onReservationHover?.(null, null)}
    >
      {showLabel ? (
        <span className={styles.eventLabel}>
          <span className={styles.eventClient}>{clientLabel}</span>
          <span className={styles.eventRef}>{reservation.reference}</span>
        </span>
      ) : null}
    </button>
  );
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
  onReservationContextMenu,
}: PlanningCalendarProps) {
  const columns = buildTimeColumns(from, to, mode);
  const rangeStartMs = from.getTime();
  const rangeEndMs = to.getTime();
  const colMin = COL_MIN_WIDTH[mode];
  const trackMinWidth = columns.length * colMin;

  const topScrollRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const syncLockRef = useRef<"top" | "main" | null>(null);
  const [hScrollWidth, setHScrollWidth] = useState(0);
  const [needsHScroll, setNeedsHScroll] = useState(false);

  const grouped = SPACE_TYPE_ORDER.map((type) => ({
    type,
    label: SPACE_TYPE_LABELS[type],
    spaces: spaces.filter((space) => space.type === type),
  })).filter((group) => group.spaces.length > 0);

  useLayoutEffect(() => {
    const main = mainScrollRef.current;
    const grid = gridRef.current;
    if (!main || !grid) return;

    const measure = () => {
      const width = grid.scrollWidth;
      setHScrollWidth(width);
      setNeedsHScroll(width > main.clientWidth + 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    observer.observe(grid);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [mode, spaces.length, columns.length, trackMinWidth, selectedReservationId]);

  function syncScroll(source: "top" | "main", left: number) {
    if (syncLockRef.current && syncLockRef.current !== source) return;
    syncLockRef.current = source;
    if (source === "top" && mainScrollRef.current) {
      mainScrollRef.current.scrollLeft = left;
    }
    if (source === "main" && topScrollRef.current) {
      topScrollRef.current.scrollLeft = left;
    }
    requestAnimationFrame(() => {
      syncLockRef.current = null;
    });
  }

  function onTopScroll(event: UIEvent<HTMLDivElement>) {
    syncScroll("top", event.currentTarget.scrollLeft);
  }

  function onMainScroll(event: UIEvent<HTMLDivElement>) {
    syncScroll("main", event.currentTarget.scrollLeft);
  }

  useEffect(() => {
    const main = mainScrollRef.current;
    const top = topScrollRef.current;
    if (!main || !top) return;
    top.scrollLeft = main.scrollLeft;
  }, [needsHScroll, hScrollWidth]);

  useEffect(() => {
    const main = mainScrollRef.current;
    const top = topScrollRef.current;
    if (!main) return;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
        return;
      }
      event.preventDefault();
      const maxLeft = Math.max(0, main.scrollWidth - main.clientWidth);
      const nextLeft = Math.max(0, Math.min(maxLeft, main.scrollLeft + event.deltaX));
      if (nextLeft === main.scrollLeft) {
        return;
      }
      syncLockRef.current = "main";
      main.scrollLeft = nextLeft;
      if (top) {
        top.scrollLeft = nextLeft;
      }
      requestAnimationFrame(() => {
        syncLockRef.current = null;
      });
    };

    main.addEventListener("wheel", onWheel, { passive: false });
    return () => main.removeEventListener("wheel", onWheel);
  }, [needsHScroll, columns.length, spaces.length]);

  if (spaces.length === 0) {
    return <div className={styles.empty}>Aucun espace actif dans le périmètre sélectionné.</div>;
  }

  const cssVars = {
    ["--col-min-width"]: `${colMin}px`,
    ["--track-min-width"]: `${trackMinWidth}px`,
  } as CSSProperties;

  return (
    <div className={styles.shell} style={cssVars}>
      <div
        ref={topScrollRef}
        className={styles.topScroll}
        data-visible={needsHScroll ? "true" : "false"}
        onScroll={onTopScroll}
        aria-hidden={!needsHScroll}
      >
        <div className={styles.topScrollSpacer} style={{ width: hScrollWidth }} />
      </div>
      <div className={styles.scrollClip}>
        <div ref={mainScrollRef} className={styles.scroll} onScroll={onMainScroll}>
          <div ref={gridRef} className={styles.grid}>
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
                  const spaceReservations = reservationsForSpace(space.id, reservations)
                    .slice()
                    .sort((a, b) => {
                      const aCancelled = a.status === "cancelled" ? 0 : 1;
                      const bCancelled = b.status === "cancelled" ? 0 : 1;
                      if (aCancelled !== bCancelled) return aCancelled - bCancelled;
                      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
                    });
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
                            return (
                              <ReservationEventBlock
                                key={reservation.id}
                                reservation={reservation}
                                leftPct={geo.leftPct}
                                widthPct={geo.widthPct}
                                lane={resolveEventLane(reservation, spaceReservations)}
                                selected={selectedReservationId === reservation.id}
                                spaceType={space.type}
                                onReservationClick={onReservationClick}
                                onReservationHover={onReservationHover}
                                onReservationContextMenu={onReservationContextMenu}
                              />
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
      </div>
    </div>
  );
}
