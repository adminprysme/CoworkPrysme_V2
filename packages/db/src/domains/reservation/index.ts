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
  validateRangeAccessibility,
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
  acquireLocksForSession,
  buildStaffQuoteLockSessionId,
  findActiveLock,
  findActiveLockBySessionId,
  findActiveLocksBySessionId,
  refreshLocksBySessionId,
  releaseLock,
  releaseLockById,
  releaseLocksBySessionId,
  SLOT_LOCK_DURATION_MS,
  type AcquireLockInput,
  type AcquireLockSlotInput,
  type ReleaseLockInput,
} from "./locks.js";
export {
  BOOKING_TIMEZONE,
  eachParisIsoDateBetween,
  getOpeningWindowForDay,
  getStaySegmentForDay,
  isRangeWithinOpeningHours,
  parisDateParts,
  parisLocalToUtc,
  parseTimeToMinutes,
  validateRangeOpeningHours,
  type OpeningHoursCheckable,
  type OpeningHoursValidationResult,
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
  getSlotLockGateModel,
  registerSlotLockGateModel,
  type SlotLockGate,
  type SlotLockGateDocument,
  type SlotLockGateModel,
} from "./slot-lock-gate.schema.js";
export {
  getSlotLockModel,
  isSlotLockValid,
  registerSlotLockModel,
  type SlotLock,
  type SlotLockDocument,
  type SlotLockModel,
} from "./slot-lock.schema.js";
