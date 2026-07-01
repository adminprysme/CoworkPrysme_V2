import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { registerModel } from "../../lib/register-model.js";
import { CREATED_AT_ONLY, objectIdRef } from "../../lib/schema-helpers.js";

export const AUTH_SOURCES = ["sso", "local"] as const;
export type AuthSource = (typeof AUTH_SOURCES)[number];

export interface StaffSession {
  sessionTokenHash: string;
  staffProfileId: Types.ObjectId;
  prysmAppUserId: string;
  authSource: AuthSource;
  expiresAt: Date;
  createdAt: Date;
}

export type StaffSessionDocument = HydratedDocument<StaffSession>;

const staffSessionSchema = new Schema<StaffSession>(
  {
    sessionTokenHash: { type: String, required: true },
    staffProfileId: objectIdRef("StaffProfile"),
    prysmAppUserId: { type: String, required: true },
    authSource: { type: String, enum: AUTH_SOURCES, required: true },
    expiresAt: { type: Date, required: true },
  },
  { ...CREATED_AT_ONLY, collection: "staffSessions" },
);

staffSessionSchema.index({ sessionTokenHash: 1 }, { unique: true });
staffSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
staffSessionSchema.index({ staffProfileId: 1 });

export type StaffSessionModel = Model<StaffSession>;

export function registerStaffSessionModel(connection: Connection): StaffSessionModel {
  return registerModel(connection, "StaffSession", staffSessionSchema);
}

export async function getStaffSessionModel(): Promise<StaffSessionModel> {
  const connection = await getCoworkDb();
  return registerStaffSessionModel(connection);
}
