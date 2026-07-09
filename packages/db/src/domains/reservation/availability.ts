import type { ClientSession, Types } from "mongoose";

import { BLOCKING_RESERVATION_STATUSES } from "../../lib/enums.js";
import { SlotUnavailableError } from "../../lib/errors.js";
import { getSlotClosureModel } from "../structure/slot-closure.schema.js";
import type { SpaceType } from "../../lib/enums.js";
import {
  getReservationModel,
  type Reservation,
  type ReservationDocument,
} from "./reservation.schema.js";
import { getSlotLockModel, isSlotLockValid, type SlotLock } from "./slot-lock.schema.js";
import { isRangeWithinOpeningHours, type OpeningHoursCheckable } from "./opening-hours.js";

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

export async function findOverlappingClosure(
  spaceId: Types.ObjectId,
  buildingId: Types.ObjectId,
  spaceType: SpaceType,
  startAt: Date,
  endAt: Date,
): Promise<boolean> {
  const SlotClosure = await getSlotClosureModel();
  const closure = await SlotClosure.findOne({
    kind: "closed",
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
    $or: [
      { "scope.spaceId": spaceId },
      { "scope.buildingId": buildingId, "scope.spaceId": { $exists: false } },
      {
        "scope.spaceType": spaceType,
        "scope.spaceId": { $exists: false },
        "scope.buildingId": { $exists: false },
      },
    ],
  })
    .lean()
    .exec();

  return closure !== null;
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
