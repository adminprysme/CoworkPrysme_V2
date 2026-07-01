import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { ACTIVE_STATUSES, SPACE_TYPES } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { objectIdRef, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";
import {
  buildingDayScheduleSchema,
  buildingPhotoSchema,
  equipmentSchema,
  seoSchema,
  type BuildingDaySchedule,
  type BuildingPhoto,
  type Equipment,
  type SeoMeta,
} from "../../lib/subdocuments.js";

export interface Space {
  buildingId: Types.ObjectId;
  type: (typeof SPACE_TYPES)[number];
  name: string;
  description?: string;
  floor?: string | number;
  capacity: number;
  equipments: Equipment[];
  photos: BuildingPhoto[];
  openingHours: BuildingDaySchedule[];
  accessCode?: string;
  status: (typeof ACTIVE_STATUSES)[number];
  seo: SeoMeta;
  createdAt: Date;
  updatedAt: Date;
}

export type SpaceDocument = HydratedDocument<Space>;

const spaceSchema = new Schema<Space>(
  {
    buildingId: objectIdRef("Building"),
    type: { type: String, enum: SPACE_TYPES, required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    floor: { type: Schema.Types.Mixed },
    capacity: { type: Number, required: true, min: 1 },
    equipments: { type: [equipmentSchema], default: [] },
    photos: { type: [buildingPhotoSchema], default: [] },
    openingHours: { type: [buildingDayScheduleSchema], default: [] },
    accessCode: { type: String, trim: true },
    status: { type: String, enum: ACTIVE_STATUSES, default: "active", required: true },
    seo: { type: seoSchema, required: true },
  },
  { ...TIMESTAMP_OPTIONS, collection: "spaces" },
);

spaceSchema.index({ buildingId: 1, type: 1, status: 1 });
spaceSchema.index({ "seo.slug": 1 }, { unique: true });

export type SpaceModel = Model<Space>;

export function registerSpaceModel(connection: Connection): SpaceModel {
  return registerModel(connection, "Space", spaceSchema);
}

export async function getSpaceModel(): Promise<SpaceModel> {
  const connection = await getCoworkDb();
  return registerSpaceModel(connection);
}

export type SpaceId = Types.ObjectId;

export { type BuildingDaySchedule, type BuildingPhoto, type Equipment, type SeoMeta };
