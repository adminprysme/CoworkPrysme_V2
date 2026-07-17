import type { BookingBuildingOption } from "@coworkprysme/shared";

export const BOOKING_BUILDING_FILTER_ALL = "all" as const;

export type BookingBuildingFilterValue = typeof BOOKING_BUILDING_FILTER_ALL | string;

/** Show the tunnel building filter only when multi-building choice is meaningful. */
export function shouldShowBookingBuildingFilter(
  buildings: readonly BookingBuildingOption[],
): boolean {
  return buildings.length >= 2;
}

/** Map UI filter value to optional API buildingId (omit when "all"). */
export function resolveBookingBuildingIdQuery(
  selected: BookingBuildingFilterValue,
): string | undefined {
  if (!selected || selected === BOOKING_BUILDING_FILTER_ALL) {
    return undefined;
  }
  return selected;
}
