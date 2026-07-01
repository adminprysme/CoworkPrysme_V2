import { Schema, type Connection, type HydratedDocument, type Model } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { STAFF_ROLES, STAFF_STATUSES } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";
import {
  staffPermissionsSchema,
  staffScopeSchema,
  type StaffPermissions,
  type StaffScope,
} from "../../lib/subdocuments.js";

export interface StaffProfile {
  prysmAppUserId: string;
  displayName: string;
  email: string;
  role: (typeof STAFF_ROLES)[number];
  permissions: StaffPermissions;
  scope: StaffScope;
  status: (typeof STAFF_STATUSES)[number];
  createdAt: Date;
  updatedAt: Date;
}

export type StaffProfileDocument = HydratedDocument<StaffProfile>;

const staffProfileSchema = new Schema<StaffProfile>(
  {
    prysmAppUserId: { type: String, required: true },
    displayName: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: STAFF_ROLES, required: true },
    permissions: { type: staffPermissionsSchema, default: () => ({}) },
    scope: { type: staffScopeSchema, default: () => ({ buildingIds: [], spaceTypes: [] }) },
    status: { type: String, enum: STAFF_STATUSES, default: "active", required: true },
  },
  { ...TIMESTAMP_OPTIONS, collection: "staffProfiles" },
);

staffProfileSchema.index({ prysmAppUserId: 1 }, { unique: true });

export type StaffProfileModel = Model<StaffProfile>;

export function registerStaffProfileModel(connection: Connection): StaffProfileModel {
  return registerModel(connection, "StaffProfile", staffProfileSchema);
}

export async function getStaffProfileModel(): Promise<StaffProfileModel> {
  const connection = await getCoworkDb();
  return registerStaffProfileModel(connection);
}
