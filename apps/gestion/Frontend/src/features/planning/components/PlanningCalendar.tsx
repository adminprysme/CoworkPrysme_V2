import type {
  PlanningCalendarReservation,
  PlanningClosureBlock,
  PlanningSpaceRow,
  PlanningSpaceType,
  PlanningViewMode,
} from "@coworkprysme/shared";

import {
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  blockGeometry,
  buildTimeColumns,
  formatCentsEur,
  formatDateTime,
} from "../planning-utils.js";
import styles from "./PlanningCalendar.module.css";

const SPACE_TYPE_ORDER: PlanningSpaceType[] = ["private_office", "meeting_room"];
const SPACE_TYPE_LABELS: Record<PlanningSpaceType, string> = {
  private_office: "Bureaux privatifs",
  meeting_room: "Salles de réunion",
};

interface PlanningCalendarProps {
  mode: PlanningViewMode;
  from: Date;
  to: Date;
  spaces: PlanningSpaceRow[];
  reservations: PlanningCalendarReservation[];
  closures: PlanningClosureBlock[];
  onReservationClick: (reservationId: string) => void;
  onSpaceNameClick: (spaceId: string) => void;
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
  onReservationClick,
  onSpaceNameClick,
}: PlanningCalendarProps) {
  const columns = buildTimeColumns(from, to, mode);
  const rangeStartMs = from.getTime();
  const rangeEndMs = to.getTime();
  const colWidth = mode === "month" ? 56 : mode === "week" ? 110 : 72;
  const trackWidth = Math.max(columns.length * colWidth, 640);

  const grouped = SPACE_TYPE_ORDER.map((type) => ({
    type,
    label: SPACE_TYPE_LABELS[type],
    spaces: spaces.filter((space) => space.type === type),
  })).filter((group) => group.spaces.length > 0);

  if (spaces.length === 0) {
    return <div className={styles.empty}>Aucun espace actif dans le périmètre sélectionné.</div>;
  }

  return (
    <div className={styles.scroll}>
      <div className={styles.grid} style={{ ["--track-width" as string]: `${trackWidth}px` }}>
        <div className={styles.corner}>Espace</div>
        <div className={styles.headerTrack}>
          {columns.map((column) => (
            <div key={column.key} className={styles.headerCell} style={{ width: colWidth }}>
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
                    <div className={styles.trackBg} style={{ width: trackWidth }}>
                      {columns.map((column) => (
                        <div
                          key={column.key}
                          className={styles.trackCell}
                          style={{ width: colWidth }}
                        />
                      ))}
                    </div>
                    <div className={styles.events} style={{ width: trackWidth }}>
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
                        const tooltip = [
                          reservation.reference,
                          reservation.clientLabel,
                          `${formatDateTime(reservation.startAt)} → ${formatDateTime(reservation.endAt)}`,
                          PAYMENT_STATUS_LABELS[reservation.paymentStatus],
                          formatCentsEur(reservation.totalTTC),
                        ].join("\n");
                        return (
                          <button
                            key={reservation.id}
                            type="button"
                            className={styles.eventBlock}
                            style={{
                              left: `${geo.leftPct}%`,
                              width: `${geo.widthPct}%`,
                              background: PAYMENT_STATUS_COLORS[reservation.paymentStatus],
                            }}
                            title={tooltip}
                            aria-label={`${reservation.reference} · ${reservation.clientLabel}`}
                            onClick={() => onReservationClick(reservation.id)}
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
  );
}
