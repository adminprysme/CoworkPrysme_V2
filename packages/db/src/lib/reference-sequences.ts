import { Schema, type ClientSession, type Connection, type Model } from "mongoose";

import { getCoworkDb } from "../connection.js";
import { registerModel } from "./register-model.js";
import { TIMESTAMP_OPTIONS } from "./schema-helpers.js";

export interface ReferenceSequence {
  prefix: string;
  year: number;
  seq: number;
  createdAt: Date;
  updatedAt: Date;
}

const referenceSequenceSchema = new Schema<ReferenceSequence>(
  {
    prefix: { type: String, required: true },
    year: { type: Number, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { ...TIMESTAMP_OPTIONS, collection: "referenceSequences" },
);

referenceSequenceSchema.index({ prefix: 1, year: 1 }, { unique: true });

export type ReferenceSequenceModel = Model<ReferenceSequence>;

export function registerReferenceSequenceModel(connection: Connection): ReferenceSequenceModel {
  return registerModel(connection, "ReferenceSequence", referenceSequenceSchema);
}

export async function getReferenceSequenceModel(): Promise<ReferenceSequenceModel> {
  const connection = await getCoworkDb();
  return registerReferenceSequenceModel(connection);
}

/** Generates a unique reference like `RES-2026-00042` inside a Mongo transaction. */
export async function nextReference(
  prefix: string,
  session: ClientSession,
  now: Date = new Date(),
): Promise<string> {
  const year = now.getFullYear();
  const ReferenceSequence = await getReferenceSequenceModel();
  const doc = await ReferenceSequence.findOneAndUpdate(
    { prefix, year },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session },
  )
    .lean()
    .exec();

  if (!doc) {
    throw new Error(`Failed to allocate reference for ${prefix}-${year}`);
  }

  return `${prefix}-${year}-${String(doc.seq).padStart(5, "0")}`;
}
