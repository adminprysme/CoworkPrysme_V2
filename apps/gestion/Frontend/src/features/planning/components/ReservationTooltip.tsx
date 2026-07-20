import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PlanningCalendarReservation } from "@coworkprysme/shared";

import { PAYMENT_STATUS_LABELS, formatCentsEur, formatDateTime } from "../planning-utils.js";
import styles from "./ReservationTooltip.module.css";

interface ReservationTooltipProps {
  reservation: PlanningCalendarReservation | null;
  anchor: DOMRect | null;
}

export function ReservationTooltip({ reservation, anchor }: ReservationTooltipProps) {
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
  }, [reservation, anchor]);

  useEffect(() => {
    if (!reservation) return;
    const hideOnScroll = () => setPos(null);
    window.addEventListener("scroll", hideOnScroll, true);
    return () => window.removeEventListener("scroll", hideOnScroll, true);
  }, [reservation]);

  if (!reservation || !anchor) {
    return null;
  }

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
      <p className={styles.ref}>{reservation.reference}</p>
      <p className={styles.client}>{reservation.clientLabel}</p>
      <p className={styles.line}>
        {formatDateTime(reservation.startAt)} → {formatDateTime(reservation.endAt)}
      </p>
      <p className={styles.line}>{PAYMENT_STATUS_LABELS[reservation.paymentStatus]}</p>
      <p className={styles.amount}>{formatCentsEur(reservation.totalTTC)}</p>
    </div>
  );
}
