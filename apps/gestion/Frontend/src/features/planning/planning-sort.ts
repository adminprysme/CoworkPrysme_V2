import type { PlanningCalendarReservation, PlanningSpaceRow } from "@coworkprysme/shared";

export type PlanningSpaceSort = "name_asc" | "capacity_asc" | "capacity_desc" | "occupancy_desc";

export const PLANNING_SPACE_SORT_OPTIONS: Array<{ value: PlanningSpaceSort; label: string }> = [
  { value: "name_asc", label: "Alphabétique (A→Z)" },
  { value: "capacity_asc", label: "Capacité croissante" },
  { value: "capacity_desc", label: "Capacité décroissante" },
  { value: "occupancy_desc", label: "Occupation (période)" },
];

function overlapMs(
  startIso: string,
  endIso: string,
  rangeStartMs: number,
  rangeEndMs: number,
): number {
  const start = Math.max(new Date(startIso).getTime(), rangeStartMs);
  const end = Math.min(new Date(endIso).getTime(), rangeEndMs);
  return Math.max(0, end - start);
}

export function sortPlanningSpaces(
  spaces: PlanningSpaceRow[],
  reservations: PlanningCalendarReservation[],
  sort: PlanningSpaceSort,
  rangeStartMs: number,
  rangeEndMs: number,
): PlanningSpaceRow[] {
  const occupancyBySpace = new Map<string, number>();
  if (sort === "occupancy_desc") {
    for (const reservation of reservations) {
      const ms = overlapMs(reservation.startAt, reservation.endAt, rangeStartMs, rangeEndMs);
      if (ms <= 0) continue;
      occupancyBySpace.set(
        reservation.spaceId,
        (occupancyBySpace.get(reservation.spaceId) ?? 0) + ms,
      );
    }
  }

  const next = [...spaces];
  next.sort((left, right) => {
    if (sort === "name_asc") {
      return left.name.localeCompare(right.name, "fr", { sensitivity: "base" });
    }
    if (sort === "capacity_asc" || sort === "capacity_desc") {
      const leftCap = left.capacity ?? -1;
      const rightCap = right.capacity ?? -1;
      const delta = leftCap - rightCap;
      if (delta !== 0) {
        return sort === "capacity_asc" ? delta : -delta;
      }
      return left.name.localeCompare(right.name, "fr", { sensitivity: "base" });
    }
    const leftOcc = occupancyBySpace.get(left.id) ?? 0;
    const rightOcc = occupancyBySpace.get(right.id) ?? 0;
    if (leftOcc !== rightOcc) {
      return rightOcc - leftOcc;
    }
    return left.name.localeCompare(right.name, "fr", { sensitivity: "base" });
  });
  return next;
}
