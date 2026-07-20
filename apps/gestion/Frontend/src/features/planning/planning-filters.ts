import type {
  PlanningCalendarReservation,
  PlanningPaymentStatus,
  PlanningSpaceRow,
  PlanningSpaceType,
} from "@coworkprysme/shared";

export type PlanningTypeFilter = "all" | PlanningSpaceType;

/** Empty set = "Tous" (no payment-status restriction). */
export type PlanningPaymentStatusFilter = Set<PlanningPaymentStatus>;

export const PLANNING_PAYMENT_FILTER_OPTIONS: Array<{
  value: PlanningPaymentStatus;
  label: string;
}> = [
  { value: "paid", label: "Payé" },
  { value: "partially_paid", label: "Partiellement payé" },
  { value: "awaiting_payment", label: "En attente" },
  { value: "none", label: "Sans paiement" },
];

export function emptyPaymentStatusFilter(): PlanningPaymentStatusFilter {
  return new Set();
}

export function isPaymentStatusFilterActive(filter: PlanningPaymentStatusFilter): boolean {
  return filter.size > 0;
}

export function hasActivePlanningFilters(input: {
  typeFilter: PlanningTypeFilter;
  paymentStatuses: PlanningPaymentStatusFilter;
  withReservationsOnly: boolean;
  showCancelled?: boolean;
}): boolean {
  return (
    input.typeFilter !== "all" ||
    isPaymentStatusFilterActive(input.paymentStatuses) ||
    input.withReservationsOnly ||
    Boolean(input.showCancelled)
  );
}

export function filterPlanningSpacesByType(
  spaces: PlanningSpaceRow[],
  typeFilter: PlanningTypeFilter,
): PlanningSpaceRow[] {
  if (typeFilter === "all") return spaces;
  return spaces.filter((space) => space.type === typeFilter);
}

export function reservationOverlapsRange(
  reservation: Pick<PlanningCalendarReservation, "startAt" | "endAt">,
  fromMs: number,
  toMs: number,
): boolean {
  return (
    new Date(reservation.startAt).getTime() < toMs && new Date(reservation.endAt).getTime() > fromMs
  );
}

/** Keep spaces that have at least one reservation overlapping the visible period. */
export function filterSpacesWithReservationsInRange(
  spaces: PlanningSpaceRow[],
  reservations: PlanningCalendarReservation[],
  fromMs: number,
  toMs: number,
): PlanningSpaceRow[] {
  const occupiedIds = new Set(
    reservations
      .filter((reservation) => reservationOverlapsRange(reservation, fromMs, toMs))
      .map((reservation) => reservation.spaceId),
  );
  return spaces.filter((space) => occupiedIds.has(space.id));
}
