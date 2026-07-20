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
