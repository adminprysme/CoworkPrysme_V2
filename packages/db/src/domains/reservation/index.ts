export {
  assertRangeAvailable,
  fetchRangeBlockingCache,
  findOverlappingActiveLock,
  findOverlappingActiveLocksInRange,
  findOverlappingClosure,
  findOverlappingClosuresInRange,
  findOverlappingReservation,
  findOverlappingReservationsInRange,
  isRangeBlocked,
  isRangeBlockedWithCache,
  rangesOverlap,
  type RangeAvailabilityContext,
  type RangeBlockingCache,
} from "./availability.js";
export {
  createReservation,
  ensureReservationIndexes,
  type CreateReservationInput,
} from "./create-reservation.js";
export {
  acquireLock,
  findActiveLock,
  releaseLock,
  releaseLockById,
  SLOT_LOCK_DURATION_MS,
  type AcquireLockInput,
  type ReleaseLockInput,
} from "./locks.js";
export {
  BOOKING_TIMEZONE,
  isRangeWithinOpeningHours,
  parisDateParts,
  parisLocalToUtc,
  parseTimeToMinutes,
  type OpeningHoursCheckable,
} from "./opening-hours.js";
export {
  getReservationModel,
  registerReservationModel,
  type Reservation,
  type ReservationDocument,
  type ReservationModel,
} from "./reservation.schema.js";
export {
  getReservationRequestModel,
  registerReservationRequestModel,
  type ReservationRequest,
  type ReservationRequestDocument,
  type ReservationRequestModel,
} from "./reservation-request.schema.js";
export {
  getSlotLockModel,
  isSlotLockValid,
  registerSlotLockModel,
  type SlotLock,
  type SlotLockDocument,
  type SlotLockModel,
} from "./slot-lock.schema.js";
