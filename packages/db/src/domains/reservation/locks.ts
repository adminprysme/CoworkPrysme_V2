import type { Types } from "mongoose";

import { connectMongo } from "../../connection.js";
import { isDuplicateKeyError, SlotLockConflictError } from "../../lib/errors.js";
import { assertReplicaSetForTransactions } from "../../lib/replica-set.js";
import { findOverlappingActiveLock } from "./availability.js";
import { getSlotLockGateModel } from "./slot-lock-gate.schema.js";
import {
  getSlotLockModel,
  isSlotLockValid,
  type SlotLock,
  type SlotLockDocument,
} from "./slot-lock.schema.js";

export const SLOT_LOCK_DURATION_MS = 10 * 60 * 1000;

export interface AcquireLockInput {
  spaceId: Types.ObjectId;
  startAt: Date;
  endAt: Date;
  sessionId: string;
  clientAccountId?: Types.ObjectId;
  partySize?: number;
  durationClass?: "hourly" | "daily";
  now?: Date;
}

export interface ReleaseLockInput {
  spaceId: Types.ObjectId;
  startAt: Date;
  endAt: Date;
  sessionId?: string;
}

/**
 * Acquires a temporary slot lock (10 min TTL) atomically.
 *
 * Inside a Mongo transaction:
 * 1. Touch a per-space gate doc (serializes concurrent acquires on the same space)
 * 2. Reject if any active lock overlaps the requested interval (not only exact tuple)
 * 3. Insert the lock
 *
 * Duplicate exact-tuple key still maps to SlotLockConflictError.
 */
export async function acquireLock(input: AcquireLockInput): Promise<SlotLockDocument> {
  const now = input.now ?? new Date();
  const mongooseInstance = await connectMongo();
  await assertReplicaSetForTransactions(mongooseInstance.connection);

  const session = await mongooseInstance.startSession();
  try {
    let created: SlotLockDocument | undefined;

    await session.withTransaction(async () => {
      const SlotLockGate = await getSlotLockGateModel();
      await SlotLockGate.findOneAndUpdate(
        { spaceId: input.spaceId },
        { $set: { updatedAt: now } },
        { upsert: true, session },
      ).exec();

      const overlap = await findOverlappingActiveLock(
        input.spaceId,
        input.startAt,
        input.endAt,
        now,
        session,
      );
      if (overlap) {
        throw new SlotLockConflictError();
      }

      const SlotLock = await getSlotLockModel();
      try {
        const [doc] = await SlotLock.create(
          [
            {
              spaceId: input.spaceId,
              startAt: input.startAt,
              endAt: input.endAt,
              sessionId: input.sessionId,
              clientAccountId: input.clientAccountId,
              partySize: input.partySize,
              durationClass: input.durationClass,
              expiresAt: new Date(now.getTime() + SLOT_LOCK_DURATION_MS),
            },
          ],
          { session },
        );
        created = doc;
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw new SlotLockConflictError();
        }
        throw error;
      }
    });

    if (!created) {
      throw new Error("Slot lock creation failed within transaction");
    }
    return created;
  } finally {
    await session.endSession();
  }
}

/** Removes a lock for the given slot (optionally scoped to sessionId). */
export async function releaseLock(input: ReleaseLockInput): Promise<boolean> {
  const SlotLock = await getSlotLockModel();
  const filter: Record<string, unknown> = {
    spaceId: input.spaceId,
    startAt: input.startAt,
    endAt: input.endAt,
  };
  if (input.sessionId) {
    filter.sessionId = input.sessionId;
  }
  const result = await SlotLock.deleteOne(filter);
  return result.deletedCount === 1;
}

/** Removes a lock by id, scoped to the owning anonymous booking session. */
export async function releaseLockById(
  lockId: Types.ObjectId | string,
  sessionId: string,
): Promise<boolean> {
  const SlotLock = await getSlotLockModel();
  const result = await SlotLock.deleteOne({
    _id: lockId,
    sessionId,
  });
  return result.deletedCount === 1;
}

/** Returns an active (non-expired) lock for the slot, if any. */
export async function findActiveLock(
  spaceId: Types.ObjectId,
  startAt: Date,
  endAt: Date,
  now: Date = new Date(),
): Promise<SlotLock | null> {
  const SlotLock = await getSlotLockModel();
  const lock = await SlotLock.findOne({ spaceId, startAt, endAt }).lean<SlotLock>().exec();
  if (!lock || !isSlotLockValid(lock, now)) {
    return null;
  }
  return lock;
}

/** Returns the newest active lock owned by an anonymous booking session, if any. */
export async function findActiveLockBySessionId(
  sessionId: string,
  now: Date = new Date(),
): Promise<(SlotLock & { _id: Types.ObjectId }) | null> {
  const SlotLock = await getSlotLockModel();
  const lock = await SlotLock.findOne({
    sessionId,
    expiresAt: { $gte: now },
  })
    .sort({ createdAt: -1 })
    .lean<SlotLock & { _id: Types.ObjectId }>()
    .exec();

  if (!lock || !isSlotLockValid(lock, now)) {
    return null;
  }

  return lock;
}
