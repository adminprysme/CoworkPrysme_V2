import type {
  PlanningPaymentStatus,
  PlanningSpaceRow,
  PlanningSpaceType,
} from "@coworkprysme/shared";

export type PlanningTypeFilter = "all" | PlanningSpaceType;
export type PlanningSpaceFilter = "all" | string;

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
  spaceFilter: PlanningSpaceFilter;
}): boolean {
  return (
    input.typeFilter !== "all" ||
    isPaymentStatusFilterActive(input.paymentStatuses) ||
    input.spaceFilter !== "all"
  );
}

export function filterPlanningSpaces(
  spaces: PlanningSpaceRow[],
  typeFilter: PlanningTypeFilter,
  spaceFilter: PlanningSpaceFilter,
): PlanningSpaceRow[] {
  return spaces.filter((space) => {
    if (typeFilter !== "all" && space.type !== typeFilter) {
      return false;
    }
    if (spaceFilter !== "all" && space.id !== spaceFilter) {
      return false;
    }
    return true;
  });
}
