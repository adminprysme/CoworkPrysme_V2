import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { SERVICE_STATUSES } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { servicePhotoSchema, type ServicePhoto } from "../../lib/subdocuments.js";
import { centsField, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";
import {
  serviceCustomQuestionSchema,
  type ServiceCustomQuestion,
} from "./service-custom-question.schema.js";

export type {
  ServiceCustomQuestion,
  ServiceCustomQuestionType,
} from "./service-custom-question.schema.js";
export { SERVICE_CUSTOM_QUESTION_TYPES } from "./service-custom-question.schema.js";
export type { ServicePhoto } from "../../lib/subdocuments.js";

export interface Service {
  key: string;
  label: string;
  description?: string;
  priceHT: number;
  vatRate: number;
  promoEligible: boolean;
  status: (typeof SERVICE_STATUSES)[number];
  customQuestions: ServiceCustomQuestion[];
  photo?: ServicePhoto;
  isGlobal: boolean;
  buildingIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export type ServiceDocument = HydratedDocument<Service>;

const serviceSchema = new Schema<Service>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String, trim: true },
    priceHT: centsField({ min: 0 }),
    vatRate: { type: Number, required: true },
    promoEligible: { type: Boolean, default: false, required: true },
    status: { type: String, enum: SERVICE_STATUSES, default: "active", required: true },
    customQuestions: { type: [serviceCustomQuestionSchema], default: [] },
    photo: { type: servicePhotoSchema, default: undefined },
    isGlobal: { type: Boolean, default: true, required: true },
    buildingIds: { type: [Schema.Types.ObjectId], default: [] },
  },
  { ...TIMESTAMP_OPTIONS, collection: "services" },
);

serviceSchema.index({ key: 1 }, { unique: true });
serviceSchema.index({ isGlobal: 1 });
serviceSchema.index({ buildingIds: 1 });

export type ServiceModel = Model<Service>;

export function registerServiceModel(connection: Connection): ServiceModel {
  return registerModel(connection, "Service", serviceSchema);
}

export async function getServiceModel(): Promise<ServiceModel> {
  const connection = await getCoworkDb();
  return registerServiceModel(connection);
}
