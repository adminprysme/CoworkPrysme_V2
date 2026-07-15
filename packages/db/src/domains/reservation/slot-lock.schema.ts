import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { registerModel } from "../../lib/register-model.js";
import { CREATED_AT_ONLY, objectIdRef, optionalObjectIdRef } from "../../lib/schema-helpers.js";

export interface SlotLock {
  spaceId: Types.ObjectId;
  startAt: Date;
  endAt: Date;
  sessionId: string;
  clientAccountId?: Types.ObjectId;
  partySize?: number;
  durationClass?: "hourly" | "daily";
  expiresAt: Date;
  createdAt: Date;
}

export type SlotLockDocument = HydratedDocument<SlotLock>;

const slotLockSchema = new Schema<SlotLock>(
  {
    spaceId: objectIdRef("Space"),
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    sessionId: { type: String, required: true },
    clientAccountId: optionalObjectIdRef("ClientAccount"),
    partySize: { type: Number, min: 1 },
    durationClass: { type: String, enum: ["hourly", "daily"] },
    expiresAt: { type: Date, required: true },
  },
  { ...CREATED_AT_ONLY, collection: "slotLocks" },
);

slotLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
slotLockSchema.index({ spaceId: 1, startAt: 1, endAt: 1 }, { unique: true });
slotLockSchema.index({ sessionId: 1, expiresAt: -1 });

export type SlotLockModel = Model<SlotLock>;

export function registerSlotLockModel(connection: Connection): SlotLockModel {
  return registerModel(connection, "SlotLock", slotLockSchema);
}

export async function getSlotLockModel(): Promise<SlotLockModel> {
  const connection = await getCoworkDb();
  return registerSlotLockModel(connection);
}

/** A lock is valid only while its TTL has not elapsed (independent of Mongo TTL purge latency). */
export function isSlotLockValid(
  lock: Pick<SlotLock, "expiresAt">,
  now: Date = new Date(),
): boolean {
  return lock.expiresAt >= now;
}
