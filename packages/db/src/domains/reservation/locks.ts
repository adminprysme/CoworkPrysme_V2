import type { Types } from "mongoose";

import { isDuplicateKeyError, SlotLockConflictError } from "../../lib/errors.js";
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
  now?: Date;
}

export interface ReleaseLockInput {
  spaceId: Types.ObjectId;
  startAt: Date;
  endAt: Date;
  sessionId?: string;
}

/**
 * Acquires a temporary slot lock (10 min TTL). Duplicate key => slot already locked.
 */
export async function acquireLock(input: AcquireLockInput): Promise<SlotLockDocument> {
  const now = input.now ?? new Date();
  const SlotLock = await getSlotLockModel();

  try {
    return await SlotLock.create({
      spaceId: input.spaceId,
      startAt: input.startAt,
      endAt: input.endAt,
      sessionId: input.sessionId,
      clientAccountId: input.clientAccountId,
      expiresAt: new Date(now.getTime() + SLOT_LOCK_DURATION_MS),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new SlotLockConflictError();
    }
    throw error;
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
