/** Thrown when a slot lock already exists for the same (spaceId, startAt, endAt) tuple. */
export class SlotLockConflictError extends Error {
  constructor(message = "Slot is already locked for this time range") {
    super(message);
    this.name = "SlotLockConflictError";
  }
}

/** Thrown when a reservation overlaps an existing pending/confirmed booking. */
export class ReservationOverlapError extends Error {
  constructor(message = "Reservation overlaps an existing pending or confirmed booking") {
    super(message);
    this.name = "ReservationOverlapError";
  }
}

/** Thrown when a slot is unavailable (overlap, closure, or outside opening hours). */
export class SlotUnavailableError extends Error {
  constructor(message = "Slot is unavailable for the requested time range") {
    super(message);
    this.name = "SlotUnavailableError";
  }
}

/** Thrown when one or more calendar days in a range are fully closed (hours or closure). */
export class RangeOpeningHoursError extends Error {
  readonly closedDays: string[];

  constructor(closedDays: string[], message?: string) {
    super(message ?? `Opening hours unavailable on: ${closedDays.join(", ")}`);
    this.name = "RangeOpeningHoursError";
    this.closedDays = closedDays;
  }
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === 11000
  );
}
