import { describe, expect, it } from "vitest";
import type { BookingBuildingOption } from "@coworkprysme/shared";

import {
  BOOKING_BUILDING_FILTER_ALL,
  resolveBookingBuildingIdQuery,
  shouldShowBookingBuildingFilter,
} from "./booking-building-filter";

const oneBuilding: BookingBuildingOption[] = [
  { id: "507f1f77bcf86cd799439012", name: "Cowork GERLAND", city: "Lyon" },
];

const twoBuildings: BookingBuildingOption[] = [
  ...oneBuilding,
  { id: "507f1f77bcf86cd799439013", name: "Cowork Part-Dieu", city: "Lyon" },
];

describe("shouldShowBookingBuildingFilter", () => {
  it("hides the filter when fewer than 2 buildings exist", () => {
    expect(shouldShowBookingBuildingFilter([])).toBe(false);
    expect(shouldShowBookingBuildingFilter(oneBuilding)).toBe(false);
  });

  it("shows the filter when 2+ buildings exist", () => {
    expect(shouldShowBookingBuildingFilter(twoBuildings)).toBe(true);
  });
});

describe("resolveBookingBuildingIdQuery", () => {
  it("omits buildingId for the default all value", () => {
    expect(resolveBookingBuildingIdQuery(BOOKING_BUILDING_FILTER_ALL)).toBeUndefined();
  });

  it("passes through a concrete building id", () => {
    expect(resolveBookingBuildingIdQuery("507f1f77bcf86cd799439013")).toBe(
      "507f1f77bcf86cd799439013",
    );
  });
});
