import { useMemo } from "react";

import styles from "./QuoteWizard.module.css";

export type AvailabilityCellKind = "free" | "busy" | "pending";

type SpaceAvailabilityPreviewProps = {
  startLocal: string;
  endLocal: string;
  /** Result of wizard availability check (sous-chantier #5). */
  available?: boolean;
  availabilityReason?: string;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatRangeLabel(startLocal: string, endLocal: string): string {
  const start = new Date(startLocal);
  const end = new Date(endLocal);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Plage à renseigner";
  }
  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  };
  return `${start.toLocaleString("fr-FR", opts)} → ${end.toLocaleString("fr-FR", opts)}`;
}

/**
 * Build a compact mini-slot timeline for the chosen range.
 * Colors mirror Planning: green free / red busy / orange pending validation.
 * Dress-up of the existing availability check (no new API).
 */
function buildCells(
  startLocal: string,
  endLocal: string,
  available: boolean | undefined,
): { key: string; kind: AvailabilityCellKind; label: string }[] {
  const start = new Date(startLocal);
  const end = new Date(endLocal);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return [];
  }

  const kind: AvailabilityCellKind =
    available === true ? "free" : available === false ? "busy" : "pending";

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const cells: { key: string; kind: AvailabilityCellKind; label: string }[] = [];

  if (sameDay) {
    const cursor = new Date(start);
    cursor.setMinutes(0, 0, 0);
    let guard = 0;
    while (cursor < end && guard < 16) {
      const hour = cursor.getHours();
      cells.push({
        key: `h-${hour}`,
        kind,
        label: `${pad2(hour)}h`,
      });
      cursor.setHours(hour + 1);
      guard += 1;
    }
  } else {
    const cursor = new Date(start);
    cursor.setHours(12, 0, 0, 0);
    let guard = 0;
    while (cursor < end && guard < 14) {
      cells.push({
        key: `d-${cursor.toISOString().slice(0, 10)}`,
        kind,
        label: cursor.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
          timeZone: "Europe/Paris",
        }),
      });
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }
  }

  return cells.length > 0 ? cells : [{ key: "range", kind, label: sameDay ? "Créneau" : "Séjour" }];
}

export function SpaceAvailabilityPreview({
  startLocal,
  endLocal,
  available,
  availabilityReason,
}: SpaceAvailabilityPreviewProps) {
  const cells = useMemo(
    () => (startLocal && endLocal ? buildCells(startLocal, endLocal, available) : []),
    [startLocal, endLocal, available],
  );

  if (!startLocal || !endLocal) {
    return (
      <div className={styles.availabilityPreview}>
        <p className={styles.availabilityHint}>
          Renseignez début et fin pour prévisualiser la disponibilité.
        </p>
      </div>
    );
  }

  const statusLabel =
    available === true
      ? "Disponible"
      : available === false
        ? `Indisponible${availabilityReason ? ` — ${availabilityReason}` : ""}`
        : "À valider (vérifier la dispo)";

  return (
    <div className={styles.availabilityPreview}>
      <div className={styles.availabilityHeader}>
        <span className={styles.availabilityTitle}>Aperçu disponibilité</span>
        <span
          className={styles.availabilityStatus}
          data-kind={available === true ? "free" : available === false ? "busy" : "pending"}
        >
          {statusLabel}
        </span>
      </div>
      <div className={styles.availabilityGrid} role="list" aria-label="Créneaux">
        {cells.map((cell) => (
          <span
            key={cell.key}
            role="listitem"
            className={styles.availabilityCell}
            data-kind={cell.kind}
            title={cell.label}
          >
            {cell.label}
          </span>
        ))}
      </div>
      <p className={styles.availabilityRange}>{formatRangeLabel(startLocal, endLocal)}</p>
      <div className={styles.availabilityLegend} aria-hidden="true">
        <span data-kind="free">Libre</span>
        <span data-kind="busy">Occupé</span>
        <span data-kind="pending">À valider</span>
      </div>
    </div>
  );
}
