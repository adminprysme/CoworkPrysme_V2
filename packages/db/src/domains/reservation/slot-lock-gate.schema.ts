import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { registerModel } from "../../lib/register-model.js";
import { objectIdRef } from "../../lib/schema-helpers.js";

/**
 * Per-space write fence for acquireLock transactions.
 * Concurrent overlapping acquires touch the same gate document so WiredTiger
 * serializes them (plain check-then-insert on distinct slotLocks docs would not).
 */
export interface SlotLockGate {
  spaceId: Types.ObjectId;
  updatedAt: Date;
}

export type SlotLockGateDocument = HydratedDocument<SlotLockGate>;

const slotLockGateSchema = new Schema<SlotLockGate>(
  {
    spaceId: objectIdRef("Space"),
    updatedAt: { type: Date, required: true },
  },
  { collection: "slotLockGates", versionKey: false },
);

slotLockGateSchema.index({ spaceId: 1 }, { unique: true });

export type SlotLockGateModel = Model<SlotLockGate>;

export function registerSlotLockGateModel(connection: Connection): SlotLockGateModel {
  return registerModel(connection, "SlotLockGate", slotLockGateSchema);
}

export async function getSlotLockGateModel(): Promise<SlotLockGateModel> {
  const connection = await getCoworkDb();
  return registerSlotLockGateModel(connection);
}
