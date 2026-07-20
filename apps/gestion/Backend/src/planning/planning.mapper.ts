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
