import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { ACTIVE_STATUSES } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";
import {
  addressSchema,
  buildingConciergeSchema,
  buildingDayScheduleSchema,
  buildingFloorSchema,
  buildingPhotoSchema,
  coordinatesSchema,
  type Address,
  type BuildingConcierge,
  type BuildingDaySchedule,
  type BuildingFloor,
  type BuildingPhoto,
  type Coordinates,
} from "../../lib/subdocuments.js";

export interface Building {
  name: string;
  description?: string;
  address: Address;
  coordinates: Coordinates;
  accessCode?: string;
  /** @deprecated Prefer accessibilityHours — kept for backward compatibility. */
  openingHours?: Record<string, unknown>;
  floors: BuildingFloor[];
  accessibilityHours: BuildingDaySchedule[];
  receptionHours: BuildingDaySchedule[];
  concierge: BuildingConcierge;
  photos: BuildingPhoto[];
  status: (typeof ACTIVE_STATUSES)[number];
  createdAt: Date;
  updatedAt: Date;
}

export type BuildingDocument = HydratedDocument<Building>;

const buildingSchema = new Schema<Building>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    address: { type: addressSchema, required: true },
    coordinates: { type: coordinatesSchema, required: true },
    accessCode: { type: String, trim: true },
    openingHours: { type: Schema.Types.Mixed },
    floors: { type: [buildingFloorSchema], default: [] },
    accessibilityHours: { type: [buildingDayScheduleSchema], default: [] },
    receptionHours: { type: [buildingDayScheduleSchema], default: [] },
    concierge: {
      type: buildingConciergeSchema,
      default: () => ({ url: "", accessCode: "" }),
    },
    photos: { type: [buildingPhotoSchema], default: [] },
    status: { type: String, enum: ACTIVE_STATUSES, default: "active", required: true },
  },
  { ...TIMESTAMP_OPTIONS, collection: "buildings" },
);

buildingSchema.index({ "coordinates.lat": 1, "coordinates.lng": 1 });
buildingSchema.index({ status: 1 });

export type BuildingModel = Model<Building>;

export function registerBuildingModel(connection: Connection): BuildingModel {
  return registerModel(connection, "Building", buildingSchema);
}

export async function getBuildingModel(): Promise<BuildingModel> {
  const connection = await getCoworkDb();
  return registerBuildingModel(connection);
}

export type BuildingId = Types.ObjectId;

export {
  type BuildingConcierge,
  type BuildingDaySchedule,
  type BuildingFloor,
  type BuildingPhoto,
  type Coordinates,
};
