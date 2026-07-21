import type { PlanningPaymentStatus, PlanningSpaceType } from "@coworkprysme/shared";

import { PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from "./planning-utils.js";
import styles from "./planning-ui.module.css";

export const SPACE_TYPE_LABELS: Record<PlanningSpaceType, string> = {
  meeting_room: "Salle de réunion",
  private_office: "Bureau privatif",
};

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  awaiting_payment: "En attente de paiement",
  confirmed: "Confirmée",
  cancelled: "Annulée",
  completed: "Terminée",
  no_show: "No-show",
};

export function clientInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function PaymentStatusBadge({
  status,
  className,
  showKindLabel = false,
}: {
  status: PlanningPaymentStatus;
  className?: string;
  /** Prefix with "Paiement ·" to distinguish from reservation status chips. */
  showKindLabel?: boolean;
}) {
  return (
    <span
      className={[styles.paymentBadge, className].filter(Boolean).join(" ")}
      title="Statut paiement"
      style={{
        background: `color-mix(in srgb, ${PAYMENT_STATUS_COLORS[status]} 22%, transparent)`,
        color: PAYMENT_STATUS_COLORS[status],
        borderColor: `color-mix(in srgb, ${PAYMENT_STATUS_COLORS[status]} 45%, transparent)`,
      }}
    >
      {showKindLabel ? <span className={styles.badgeKind}>Paiement</span> : null}
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}

export function ClientAvatar({ label, size = 32 }: { label: string; size?: number }) {
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
      aria-hidden
    >
      {clientInitials(label)}
    </span>
  );
}
