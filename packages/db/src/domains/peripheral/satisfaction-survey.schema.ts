import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { SATISFACTION_LEVELS } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { objectIdRef, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";

export interface SatisfactionSurvey {
  cardexId: Types.ObjectId;
  reservationId: Types.ObjectId;
  level: (typeof SATISFACTION_LEVELS)[number];
  answeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type SatisfactionSurveyDocument = HydratedDocument<SatisfactionSurvey>;

const satisfactionSurveySchema = new Schema<SatisfactionSurvey>(
  {
    cardexId: objectIdRef("Cardex"),
    reservationId: objectIdRef("Reservation"),
    level: { type: String, enum: SATISFACTION_LEVELS, required: true },
    answeredAt: { type: Date, required: true },
  },
  { ...TIMESTAMP_OPTIONS, collection: "satisfactionSurveys" },
);

satisfactionSurveySchema.index({ cardexId: 1, answeredAt: -1 });

export type SatisfactionSurveyModel = Model<SatisfactionSurvey>;

export function registerSatisfactionSurveyModel(connection: Connection): SatisfactionSurveyModel {
  return registerModel(connection, "SatisfactionSurvey", satisfactionSurveySchema);
}

export async function getSatisfactionSurveyModel(): Promise<SatisfactionSurveyModel> {
  const connection = await getCoworkDb();
  return registerSatisfactionSurveyModel(connection);
}
