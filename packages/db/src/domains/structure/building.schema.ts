import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { ACTIVE_STATUSES } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";
import { addressSchema, type Address } from "../../lib/subdocuments.js";
import { getCoworkDb } from "../../connection.js";

export interface Building {
  name: string;
  description?: string;
  address: Address;
  accessCode?: string;
  openingHours?: Record<string, unknown>;
  status: (typeof ACTIVE_STATUSES)[number];
  createdAt: Date;
  updatedAt: Date;
}

export type BuildingDocument = HydratedDocument<Building>;

const buildingSchema = new Schema<Building>(
  {
    name: { type: String, required: true },
    description: { type: String },
    address: { type: addressSchema, required: true },
    accessCode: { type: String },
    openingHours: { type: Schema.Types.Mixed },
    status: { type: String, enum: ACTIVE_STATUSES, default: "active", required: true },
  },
  { ...TIMESTAMP_OPTIONS, collection: "buildings" },
);

export type BuildingModel = Model<Building>;

export function registerBuildingModel(connection: Connection): BuildingModel {
  return registerModel(connection, "Building", buildingSchema);
}

export async function getBuildingModel(): Promise<BuildingModel> {
  const connection = await getCoworkDb();
  return registerBuildingModel(connection);
}

export type BuildingId = Types.ObjectId;
