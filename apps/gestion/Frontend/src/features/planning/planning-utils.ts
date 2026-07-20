import type { PlanningPaymentStatus, PlanningViewMode } from "@coworkprysme/shared";

export const PAYMENT_STATUS_LABELS: Record<PlanningPaymentStatus, string> = {
  paid: "Payé",
  partially_paid: "Partiellement payé",
  awaiting_payment: "En attente de paiement",
  none: "Sans paiement",
};

export const PAYMENT_STATUS_COLORS: Record<PlanningPaymentStatus, string> = {
  paid: "var(--planning-paid)",
  partially_paid: "var(--planning-partial)",
  awaiting_payment: "var(--planning-awaiting)",
  none: "var(--planning-none)",
};

export const VIEW_MODE_LABELS: Record<PlanningViewMode, string> = {
  month: "Mois",
  week: "Semaine",
  day: "Jour",
};

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeekMonday(date: Date): Date {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(next, diff);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endExclusiveForView(anchor: Date, mode: PlanningViewMode): Date {
  if (mode === "day") {
    return addDays(startOfDay(anchor), 1);
  }
  if (mode === "week") {
    return addDays(startOfWeekMonday(anchor), 7);
  }
  return new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
}

export function rangeForView(anchor: Date, mode: PlanningViewMode): { from: Date; to: Date } {
  if (mode === "day") {
    const from = startOfDay(anchor);
    from.setHours(7, 0, 0, 0);
    const to = startOfDay(anchor);
    to.setHours(22, 0, 0, 0);
    return { from, to };
  }
  if (mode === "week") {
    const from = startOfWeekMonday(anchor);
    return { from, to: addDays(from, 7) };
  }
  const from = startOfMonth(anchor);
  return { from, to: new Date(from.getFullYear(), from.getMonth() + 1, 1) };
}

export function shiftAnchor(anchor: Date, mode: PlanningViewMode, direction: -1 | 1): Date {
  if (mode === "day") {
    return addDays(anchor, direction);
  }
  if (mode === "week") {
    return addDays(anchor, direction * 7);
  }
  return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
}

export function formatRangeLabel(anchor: Date, mode: PlanningViewMode): string {
  if (mode === "day") {
    return anchor.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (mode === "week") {
    const from = startOfWeekMonday(anchor);
    const to = addDays(from, 6);
    return `${from.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${to.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
  }
  return anchor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function formatCentsEur(cents: number): string {
  const euros = Math.trunc(cents / 100);
  const fraction = Math.abs(cents % 100);
  return `${euros},${String(fraction).padStart(2, "0")} €`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Column definitions for the time axis. */
export interface TimeColumn {
  key: string;
  label: string;
  startMs: number;
  endMs: number;
}

export function buildTimeColumns(from: Date, to: Date, mode: PlanningViewMode): TimeColumn[] {
  if (mode === "day") {
    const columns: TimeColumn[] = [];
    for (let hour = 7; hour < 22; hour += 1) {
      const start = new Date(from);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(from);
      end.setHours(hour + 1, 0, 0, 0);
      columns.push({
        key: `h-${hour}`,
        label: `${String(hour).padStart(2, "0")}h`,
        startMs: start.getTime(),
        endMs: end.getTime(),
      });
    }
    return columns;
  }

  const columns: TimeColumn[] = [];
  let cursor = new Date(from);
  while (cursor < to) {
    const next = addDays(cursor, 1);
    columns.push({
      key: cursor.toISOString().slice(0, 10),
      label: cursor.toLocaleDateString("fr-FR", {
        weekday: mode === "week" ? "short" : undefined,
        day: "numeric",
        month: mode === "month" ? "short" : undefined,
      }),
      startMs: cursor.getTime(),
      endMs: next.getTime(),
    });
    cursor = next;
  }
  return columns;
}

export function blockGeometry(
  startIso: string,
  endIso: string,
  rangeStartMs: number,
  rangeEndMs: number,
): { leftPct: number; widthPct: number } | null {
  const start = Math.max(new Date(startIso).getTime(), rangeStartMs);
  const end = Math.min(new Date(endIso).getTime(), rangeEndMs);
  if (end <= start) {
    return null;
  }
  const span = rangeEndMs - rangeStartMs;
  if (span <= 0) {
    return null;
  }
  return {
    leftPct: ((start - rangeStartMs) / span) * 100,
    widthPct: Math.max(((end - start) / span) * 100, 0.8),
  };
}
