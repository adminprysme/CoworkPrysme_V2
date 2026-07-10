import type { ClientSession, Types } from "mongoose";

import { BLOCKING_RESERVATION_STATUSES } from "../../lib/enums.js";
import { RangeOpeningHoursError, SlotUnavailableError } from "../../lib/errors.js";
import { getSlotClosureModel, type SlotClosure } from "../structure/slot-closure.schema.js";
import type { SpaceType } from "../../lib/enums.js";
import {
  getReservationModel,
  type Reservation,
  type ReservationDocument,
} from "./reservation.schema.js";
import { getSlotLockModel, isSlotLockValid, type SlotLock } from "./slot-lock.schema.js";
import {
  eachParisIsoDateBetween,
  getOpeningWindowForDay,
  getStaySegmentForDay,
  rangesOverlap,
  validateRangeOpeningHours,
  parisDateParts,
  parisLocalToUtc,
  type OpeningHoursCheckable,
  type OpeningHoursValidationResult,
} from "./opening-hours.js";

export interface RangeBlockingCache {
  reservations: Reservation[];
  locks: SlotLock[];
  closures: SlotClosure[];
}

export interface RangeAvailabilityContext {
  spaceId: Types.ObjectId;
  buildingId: Types.ObjectId;
  spaceType: SpaceType;
  openingHours: OpeningHoursCheckable["openingHours"];
  startAt: Date;
  endAt: Date;
  now?: Date;
}

export { rangesOverlap };

export async function findOverlappingReservation(
  spaceId: Types.ObjectId,
  startAt: Date,
  endAt: Date,
  session?: ClientSession,
): Promise<ReservationDocument | null> {
  const Reservation = await getReservationModel();
  const query = Reservation.findOne({
    spaceId,
    status: { $in: BLOCKING_RESERVATION_STATUSES },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  });

  if (session) {
    query.session(session);
  }

  return query.exec();
}

export async function findOverlappingActiveLock(
  spaceId: Types.ObjectId,
  startAt: Date,
  endAt: Date,
  now: Date = new Date(),
): Promise<SlotLock | null> {
  const SlotLock = await getSlotLockModel();
  const locks = await SlotLock.find({
    spaceId,
    expiresAt: { $gte: now },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  })
    .lean<SlotLock[]>()
    .exec();

  return locks.find((lock) => isSlotLockValid(lock, now)) ?? null;
}

function closureScopeFilter(
  spaceId: Types.ObjectId,
  buildingId: Types.ObjectId,
  spaceType: SpaceType,
) {
  return {
    kind: "closed" as const,
    $or: [
      { "scope.spaceId": spaceId },
      { "scope.buildingId": buildingId, "scope.spaceId": { $exists: false } },
      {
        "scope.spaceType": spaceType,
        "scope.spaceId": { $exists: false },
        "scope.buildingId": { $exists: false },
      },
    ],
  };
}

export async function findOverlappingClosuresInRange(
  spaceId: Types.ObjectId,
  buildingId: Types.ObjectId,
  spaceType: SpaceType,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<SlotClosure[]> {
  const SlotClosure = await getSlotClosureModel();
  return SlotClosure.find({
    ...closureScopeFilter(spaceId, buildingId, spaceType),
    startAt: { $lt: rangeEnd },
    endAt: { $gt: rangeStart },
  })
    .lean<SlotClosure[]>()
    .exec();
}

export async function findOverlappingClosure(
  spaceId: Types.ObjectId,
  buildingId: Types.ObjectId,
  spaceType: SpaceType,
  startAt: Date,
  endAt: Date,
): Promise<boolean> {
  const closures = await findOverlappingClosuresInRange(
    spaceId,
    buildingId,
    spaceType,
    startAt,
    endAt,
  );
  return closures.some((closure) => rangesOverlap(startAt, endAt, closure.startAt, closure.endAt));
}

export async function findOverlappingReservationsInRange(
  spaceId: Types.ObjectId,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Reservation[]> {
  const Reservation = await getReservationModel();
  return Reservation.find({
    spaceId,
    status: { $in: BLOCKING_RESERVATION_STATUSES },
    startAt: { $lt: rangeEnd },
    endAt: { $gt: rangeStart },
  })
    .lean<Reservation[]>()
    .exec();
}

export async function findOverlappingActiveLocksInRange(
  spaceId: Types.ObjectId,
  rangeStart: Date,
  rangeEnd: Date,
  now: Date = new Date(),
): Promise<SlotLock[]> {
  const SlotLock = await getSlotLockModel();
  const locks = await SlotLock.find({
    spaceId,
    expiresAt: { $gte: now },
    startAt: { $lt: rangeEnd },
    endAt: { $gt: rangeStart },
  })
    .lean<SlotLock[]>()
    .exec();

  return locks.filter((lock) => isSlotLockValid(lock, now));
}

export async function fetchRangeBlockingCache(
  context: Pick<
    RangeAvailabilityContext,
    "spaceId" | "buildingId" | "spaceType" | "startAt" | "endAt" | "now"
  >,
): Promise<RangeBlockingCache> {
  const now = context.now ?? new Date();
  const [reservations, locks, closures] = await Promise.all([
    findOverlappingReservationsInRange(context.spaceId, context.startAt, context.endAt),
    findOverlappingActiveLocksInRange(context.spaceId, context.startAt, context.endAt, now),
    findOverlappingClosuresInRange(
      context.spaceId,
      context.buildingId,
      context.spaceType,
      context.startAt,
      context.endAt,
    ),
  ]);

  return { reservations, locks, closures };
}

function isSegmentFullyCoveredByClosures(
  segmentStart: Date,
  segmentEnd: Date,
  closures: Array<{ startAt: Date; endAt: Date }>,
): boolean {
  const relevant = closures
    .filter((closure) => rangesOverlap(segmentStart, segmentEnd, closure.startAt, closure.endAt))
    .map((closure) => ({
      start: closure.startAt > segmentStart ? closure.startAt : segmentStart,
      end: closure.endAt < segmentEnd ? closure.endAt : segmentEnd,
    }))
    .sort((left, right) => left.start.getTime() - right.start.getTime());

  if (relevant.length === 0) {
    return false;
  }

  let cursor = segmentStart.getTime();
  for (const interval of relevant) {
    if (interval.start.getTime() > cursor) {
      return false;
    }
    cursor = Math.max(cursor, interval.end.getTime());
  }

  return cursor >= segmentEnd.getTime();
}

export function validateRangeAccessibility(
  context: RangeAvailabilityContext,
  closures: Array<{ startAt: Date; endAt: Date }> = [],
): OpeningHoursValidationResult {
  if (context.endAt <= context.startAt) {
    return { valid: false, closedDays: [] };
  }

  if (context.openingHours.length === 0) {
    const isoDates = eachParisIsoDateBetween(context.startAt, context.endAt);
    const closedDays: string[] = [];

    for (const isoDate of isoDates) {
      const staySegment = getStaySegmentForDay(isoDate, isoDates, context.startAt, context.endAt);
      if (!staySegment) {
        closedDays.push(isoDate);
        continue;
      }

      if (isSegmentFullyCoveredByClosures(staySegment.start, staySegment.end, closures)) {
        closedDays.push(isoDate);
      }
    }

    if (closedDays.length > 0) {
      return { valid: false, closedDays };
    }

    return { valid: true };
  }

  const openingResult = validateRangeOpeningHours(context, context.startAt, context.endAt);
  if (!openingResult.valid) {
    return openingResult;
  }

  const isoDates = eachParisIsoDateBetween(context.startAt, context.endAt);
  const closedDays: string[] = [];

  for (const isoDate of isoDates) {
    const staySegment = getStaySegmentForDay(isoDate, isoDates, context.startAt, context.endAt);
    if (!staySegment) {
      closedDays.push(isoDate);
      continue;
    }

    const weekday = parisDateParts(parisLocalToUtc(isoDate, "12:00")).day;
    const schedule = context.openingHours.find((entry) => entry.day === weekday);
    if (!schedule) {
      closedDays.push(isoDate);
      continue;
    }

    const openingWindow = getOpeningWindowForDay(schedule, isoDate);
    if (!openingWindow) {
      closedDays.push(isoDate);
      continue;
    }

    const accessibleStart =
      staySegment.start > openingWindow.start ? staySegment.start : openingWindow.start;
    const accessibleEnd = staySegment.end < openingWindow.end ? staySegment.end : openingWindow.end;
    if (accessibleEnd <= accessibleStart) {
      closedDays.push(isoDate);
      continue;
    }

    if (isSegmentFullyCoveredByClosures(accessibleStart, accessibleEnd, closures)) {
      closedDays.push(isoDate);
    }
  }

  if (closedDays.length > 0) {
    return { valid: false, closedDays };
  }

  return { valid: true };
}

export function isRangeBlockedWithCache(
  context: RangeAvailabilityContext,
  cache: RangeBlockingCache,
): boolean {
  if (context.endAt <= context.startAt) {
    return true;
  }

  const accessibility = validateRangeAccessibility(context, cache.closures);
  if (!accessibility.valid) {
    return true;
  }

  const { startAt, endAt } = context;
  const hasReservation = cache.reservations.some((reservation) =>
    rangesOverlap(startAt, endAt, reservation.startAt, reservation.endAt),
  );
  const hasLock = cache.locks.some((lock) =>
    rangesOverlap(startAt, endAt, lock.startAt, lock.endAt),
  );

  return hasReservation || hasLock;
}

export async function isRangeBlocked(context: RangeAvailabilityContext): Promise<boolean> {
  if (context.endAt <= context.startAt) {
    return true;
  }

  const cache = await fetchRangeBlockingCache(context);
  return isRangeBlockedWithCache(context, cache);
}

export async function assertRangeAvailable(context: RangeAvailabilityContext): Promise<void> {
  if (context.endAt <= context.startAt) {
    throw new SlotUnavailableError();
  }

  const cache = await fetchRangeBlockingCache(context);
  const accessibility = validateRangeAccessibility(context, cache.closures);
  if (!accessibility.valid) {
    throw new RangeOpeningHoursError(accessibility.closedDays);
  }

  const { startAt, endAt } = context;
  const hasReservation = cache.reservations.some((reservation) =>
    rangesOverlap(startAt, endAt, reservation.startAt, reservation.endAt),
  );
  const hasLock = cache.locks.some((lock) =>
    rangesOverlap(startAt, endAt, lock.startAt, lock.endAt),
  );

  if (hasReservation || hasLock) {
    throw new SlotUnavailableError();
  }
}

export type { Reservation };
