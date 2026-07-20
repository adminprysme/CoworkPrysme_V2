import type {
  PlanningPaymentStatus,
  PlanningReservationStatus,
  PlanningSpaceType,
} from "@coworkprysme/shared";
import type { Types } from "mongoose";

export function scopedBuildingFilter(buildingIds: Types.ObjectId[]): Record<string, unknown> {
  if (buildingIds.length === 0) {
    return {};
  }
  return { buildingId: { $in: buildingIds } };
}

export function isBuildingIdInScope(
  buildingId: Types.ObjectId,
  scopedIds: Types.ObjectId[],
): boolean {
  if (scopedIds.length === 0) {
    return true;
  }
  return scopedIds.some((id) => id.equals(buildingId));
}

export function mapInvoicePaymentStatus(input: {
  invoiceStatus?: string;
  paidTotal?: number;
  balanceDue?: number;
  reservationStatus: PlanningReservationStatus;
}): PlanningPaymentStatus {
  const { invoiceStatus, paidTotal = 0, balanceDue, reservationStatus } = input;

  if (!invoiceStatus) {
    if (reservationStatus === "awaiting_payment" || reservationStatus === "pending") {
      return "awaiting_payment";
    }
    if (reservationStatus === "cancelled" || reservationStatus === "no_show") {
      return "none";
    }
    return "awaiting_payment";
  }

  if (invoiceStatus === "cancelled") {
    return "none";
  }
  if (invoiceStatus === "paid" || balanceDue === 0) {
    return "paid";
  }
  if (invoiceStatus === "partially_paid" || paidTotal > 0) {
    return "partially_paid";
  }
  return "awaiting_payment";
}

export function formatClientLabel(input: {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
}): string {
  const company = input.companyName?.trim();
  if (company) {
    return company;
  }
  const name = [input.firstName, input.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (name) {
    return name;
  }
  if (input.email?.trim()) {
    return input.email.trim();
  }
  return "Client inconnu";
}

export function isReservationReadOnly(status: PlanningReservationStatus): boolean {
  return status === "cancelled" || status === "completed" || status === "no_show";
}

export type PlanningContactLinkVia = "reservation" | "cardex";

/**
 * Merges contact account ids for the Contacts tab.
 * Reservation booker wins over cardex/company siblings for `linkedVia`.
 */
export function mergeContactAccountIds(
  seeds: ReadonlyArray<{ id: string; via: PlanningContactLinkVia }>,
): Map<string, PlanningContactLinkVia> {
  const contactIds = new Map<string, PlanningContactLinkVia>();
  for (const seed of seeds) {
    const id = seed.id.trim();
    if (!id) {
      continue;
    }
    const existing = contactIds.get(id);
    if (!existing || (existing === "cardex" && seed.via === "reservation")) {
      contactIds.set(id, seed.via);
    }
  }
  return contactIds;
}

/**
 * Breaks down reservation.pricing.subtotalHT into space + services using
 * server-stored snapshots only (never re-priced from tariffs).
 */
export function splitReservationSubtotalHT(input: {
  subtotalHT: number;
  services: ReadonlyArray<{ qty: number; unitPriceHT: number }>;
  invoiceSpaceLines?: ReadonlyArray<{ qty: number; unitPriceHT: number }>;
}): { spaceHT: number; servicesHT: number } {
  const servicesHT = input.services.reduce(
    (sum, line) => sum + Math.trunc(line.qty) * Math.trunc(line.unitPriceHT),
    0,
  );
  const invoiceSpaceHT = (input.invoiceSpaceLines ?? []).reduce(
    (sum, line) => sum + Math.trunc(line.qty) * Math.trunc(line.unitPriceHT),
    0,
  );
  const spaceHT =
    input.invoiceSpaceLines && input.invoiceSpaceLines.length > 0
      ? invoiceSpaceHT
      : Math.max(0, Math.trunc(input.subtotalHT) - servicesHT);
  return { spaceHT, servicesHT };
}

export function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

/** Monday 00:00 of the week containing `date`. */
export function startOfWeekMondayLocal(date: Date): Date {
  const next = startOfLocalDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

/** Sunday 23:59:59.999 of the week containing `date`. */
export function endOfWeekSundayLocal(date: Date): Date {
  const start = startOfWeekMondayLocal(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function startOfMonthLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonthLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function occupancyRatePercent(occupied: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((occupied / total) * 100);
}

export function rangesOverlap(
  startAt: Date,
  endAt: Date,
  periodStart: Date,
  periodEnd: Date,
): boolean {
  return startAt.getTime() < periodEnd.getTime() && endAt.getTime() > periodStart.getTime();
}

const MONTH_LONG = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const DAY_LONG = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const DAY_MONTH = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

function capitalizeFr(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatOccupancyDayLabel(date: Date): string {
  return DAY_LONG.format(date);
}

export function formatOccupancyMonthLabel(date: Date): string {
  return capitalizeFr(MONTH_LONG.format(date));
}

/** e.g. "Semaine du 20 au 26 juillet 2026" (Monday–Sunday). */
export function formatOccupancyWeekLabel(weekStart: Date, weekEnd: Date): string {
  const sameMonth =
    weekStart.getMonth() === weekEnd.getMonth() &&
    weekStart.getFullYear() === weekEnd.getFullYear();
  if (sameMonth) {
    const monthYear = MONTH_LONG.format(weekStart);
    return `Semaine du ${weekStart.getDate()} au ${weekEnd.getDate()} ${monthYear}`;
  }
  return `Semaine du ${DAY_MONTH.format(weekStart)} au ${DAY_LONG.format(weekEnd)}`;
}

export function asSpaceType(value: string): PlanningSpaceType {
  return value === "private_office" ? "private_office" : "meeting_room";
}

export function asReservationStatus(value: string): PlanningReservationStatus {
  switch (value) {
    case "pending":
    case "awaiting_payment":
    case "confirmed":
    case "cancelled":
    case "completed":
    case "no_show":
      return value;
    default:
      return "pending";
  }
}
