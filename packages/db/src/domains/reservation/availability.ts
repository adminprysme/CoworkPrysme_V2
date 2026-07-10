import type { ClientSession, Types } from "mongoose";

import { BLOCKING_RESERVATION_STATUSES } from "../../lib/enums.js";
import { SlotUnavailableError } from "../../lib/errors.js";
import { getSlotClosureModel, type SlotClosure } from "../structure/slot-closure.schema.js";
import type { SpaceType } from "../../lib/enums.js";
import {
  getReservationModel,
  type Reservation,
  type ReservationDocument,
} from "./reservation.schema.js";
import { getSlotLockModel, isSlotLockValid, type SlotLock } from "./slot-lock.schema.js";
import { isRangeWithinOpeningHours, type OpeningHoursCheckable } from "./opening-hours.js";

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

/** Standard interval overlap: [startAt, endAt) intersects existing range. */
export function rangesOverlap(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
): boolean {
  return leftStart < rightEnd && leftEnd > rightStart;
}

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

export function isRangeBlockedWithCache(
  context: RangeAvailabilityContext,
  cache: RangeBlockingCache,
): boolean {
  if (context.endAt <= context.startAt) {
    return true;
  }

  if (!isRangeWithinOpeningHours(context, context.startAt, context.endAt)) {
    return true;
  }

  const { startAt, endAt } = context;
  const hasReservation = cache.reservations.some((reservation) =>
    rangesOverlap(startAt, endAt, reservation.startAt, reservation.endAt),
  );
  const hasLock = cache.locks.some((lock) =>
    rangesOverlap(startAt, endAt, lock.startAt, lock.endAt),
  );
  const hasClosure = cache.closures.some((closure) =>
    rangesOverlap(startAt, endAt, closure.startAt, closure.endAt),
  );

  return hasReservation || hasLock || hasClosure;
}

export async function isRangeBlocked(context: RangeAvailabilityContext): Promise<boolean> {
  const now = context.now ?? new Date();

  if (context.endAt <= context.startAt) {
    return true;
  }

  if (!isRangeWithinOpeningHours(context, context.startAt, context.endAt)) {
    return true;
  }

  const [reservation, lock, hasClosure] = await Promise.all([
    findOverlappingReservation(context.spaceId, context.startAt, context.endAt),
    findOverlappingActiveLock(context.spaceId, context.startAt, context.endAt, now),
    findOverlappingClosure(
      context.spaceId,
      context.buildingId,
      context.spaceType,
      context.startAt,
      context.endAt,
    ),
  ]);

  return reservation !== null || lock !== null || hasClosure;
}

export async function assertRangeAvailable(context: RangeAvailabilityContext): Promise<void> {
  if (await isRangeBlocked(context)) {
    throw new SlotUnavailableError();
  }
}

export type { Reservation };
