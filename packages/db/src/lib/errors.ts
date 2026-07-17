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

/** Thrown when a booking lock is missing, expired, or already consumed. */
export class LockNotAvailableError extends Error {
  constructor(message = "Booking lock is not available") {
    super(message);
    this.name = "LockNotAvailableError";
  }
}

/** Thrown when lock data does not match the confirm request payload. */
export class LockMismatchError extends Error {
  constructor(message = "Booking lock does not match the requested slot") {
    super(message);
    this.name = "LockMismatchError";
  }
}

/** Thrown when client credentials are invalid during booking confirm. */
export class InvalidCredentialsError extends Error {
  constructor(message = "Invalid email or password") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

/** Thrown when a new account email is already registered. */
export class EmailAlreadyRegisteredError extends Error {
  constructor(message = "An account with this email already exists") {
    super(message);
    this.name = "EmailAlreadyRegisteredError";
  }
}

/** Thrown when an invoice referenced by a payment webhook/intent is missing. */
export class InvoiceNotFoundError extends Error {
  constructor(message = "Invoice not found") {
    super(message);
    this.name = "InvoiceNotFoundError";
  }
}

/**
 * Thrown when a Stripe card payment amount does not exactly match invoice.balanceDue.
 * Partial card payments are intentionally rejected until an explicit product decision.
 */
export class StripePaymentAmountMismatchError extends Error {
  readonly amountReceived: number;
  readonly balanceDue: number;

  constructor(amountReceived: number, balanceDue: number) {
    super(`Stripe amount ${amountReceived} does not match invoice balanceDue ${balanceDue}`);
    this.name = "StripePaymentAmountMismatchError";
    this.amountReceived = amountReceived;
    this.balanceDue = balanceDue;
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
