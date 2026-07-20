import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconCalendar, IconDoor } from "@tabler/icons-react";
import type { PlanningCalendarReservation, PlanningSpaceType } from "@coworkprysme/shared";

import { ClientAvatar, PaymentStatusBadge, SPACE_TYPE_LABELS } from "../planning-ui.js";
import { formatCentsEur, formatDateTime } from "../planning-utils.js";
import styles from "./ReservationTooltip.module.css";

export interface ReservationTooltipMeta {
  spaceType?: PlanningSpaceType;
}

interface ReservationTooltipProps {
  reservation: PlanningCalendarReservation | null;
  anchor: DOMRect | null;
  meta?: ReservationTooltipMeta | null;
}

export function ReservationTooltip({ reservation, anchor, meta }: ReservationTooltipProps) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!reservation || !anchor || !tipRef.current) {
      setPos(null);
      return;
    }
    const tip = tipRef.current.getBoundingClientRect();
    const gap = 10;
    let left = anchor.left + anchor.width / 2 - tip.width / 2;
    let top = anchor.top - tip.height - gap;
    left = Math.max(8, Math.min(left, window.innerWidth - tip.width - 8));
    if (top < 8) {
      top = anchor.bottom + gap;
    }
    setPos({ top, left });
  }, [reservation, anchor, meta]);

  useEffect(() => {
    if (!reservation) return;
    const hideOnScroll = () => setPos(null);
    window.addEventListener("scroll", hideOnScroll, true);
    return () => window.removeEventListener("scroll", hideOnScroll, true);
  }, [reservation]);

  if (!reservation || !anchor) {
    return null;
  }

  const spaceTypeLabel = meta?.spaceType ? SPACE_TYPE_LABELS[meta.spaceType] : null;

  return (
    <div
      ref={tipRef}
      className={styles.tooltip}
      role="tooltip"
      style={
        pos
          ? { top: pos.top, left: pos.left, visibility: "visible" }
          : { top: 0, left: 0, visibility: "hidden" }
      }
    >
      <div className={styles.header}>
        <div className={styles.identity}>
          <ClientAvatar label={reservation.clientLabel} size={34} />
          <span className={styles.clientName}>{reservation.clientLabel}</span>
        </div>
        <PaymentStatusBadge status={reservation.paymentStatus} />
      </div>

      <p className={styles.reference}>{reservation.reference}</p>

      <div className={styles.divider} />

      <div className={styles.rows}>
        <div className={styles.row}>
          <IconCalendar size={15} stroke={1.6} className={styles.icon} aria-hidden />
          <span>
            {formatDateTime(reservation.startAt)} → {formatDateTime(reservation.endAt)}
          </span>
        </div>
        <div className={styles.row}>
          <IconDoor size={15} stroke={1.6} className={styles.icon} aria-hidden />
          <span>
            {reservation.spaceName}
            {spaceTypeLabel ? ` · ${spaceTypeLabel}` : null}
          </span>
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.totalRow}>
        <span className={styles.totalLabel}>Total TTC</span>
        <span className={styles.totalValue}>{formatCentsEur(reservation.totalTTC)}</span>
      </div>
    </div>
  );
}
