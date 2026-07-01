import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { SLOT_CLOSURE_KINDS } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { objectIdRef, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";
import { slotClosureScopeSchema, type SlotClosureScope } from "../../lib/subdocuments.js";
import { getCoworkDb } from "../../connection.js";

export interface SlotClosure {
  scope: SlotClosureScope;
  kind: (typeof SLOT_CLOSURE_KINDS)[number];
  startAt: Date;
  endAt: Date;
  reason?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type SlotClosureDocument = HydratedDocument<SlotClosure>;

const slotClosureSchema = new Schema<SlotClosure>(
  {
    scope: { type: slotClosureScopeSchema, required: true, default: {} },
    kind: { type: String, enum: SLOT_CLOSURE_KINDS, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    reason: { type: String },
    createdBy: objectIdRef("StaffProfile"),
  },
  { ...TIMESTAMP_OPTIONS, collection: "slotClosures" },
);

slotClosureSchema.index({ "scope.spaceId": 1, startAt: 1, endAt: 1 });

export type SlotClosureModel = Model<SlotClosure>;

export function registerSlotClosureModel(connection: Connection): SlotClosureModel {
  return registerModel(connection, "SlotClosure", slotClosureSchema);
}

export async function getSlotClosureModel(): Promise<SlotClosureModel> {
  const connection = await getCoworkDb();
  return registerSlotClosureModel(connection);
}
