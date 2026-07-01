import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { INCIDENT_REPORTER_KINDS, INCIDENT_STATUSES } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { optionalObjectIdRef, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";

export interface IncidentReporter {
  kind: (typeof INCIDENT_REPORTER_KINDS)[number];
  id: Types.ObjectId;
}

export interface Incident {
  reportedBy: IncidentReporter;
  spaceId?: Types.ObjectId;
  buildingId?: Types.ObjectId;
  description: string;
  status: (typeof INCIDENT_STATUSES)[number];
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type IncidentDocument = HydratedDocument<Incident>;

const incidentReporterSchema = new Schema<IncidentReporter>(
  {
    kind: { type: String, enum: INCIDENT_REPORTER_KINDS, required: true },
    id: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false },
);

const incidentSchema = new Schema<Incident>(
  {
    reportedBy: { type: incidentReporterSchema, required: true },
    spaceId: optionalObjectIdRef("Space"),
    buildingId: optionalObjectIdRef("Building"),
    description: { type: String, required: true },
    status: { type: String, enum: INCIDENT_STATUSES, default: "open", required: true },
    resolvedAt: { type: Date },
  },
  { ...TIMESTAMP_OPTIONS, collection: "incidents" },
);

incidentSchema.index({ status: 1, createdAt: -1 });

export type IncidentModel = Model<Incident>;

export function registerIncidentModel(connection: Connection): IncidentModel {
  return registerModel(connection, "Incident", incidentSchema);
}

export async function getIncidentModel(): Promise<IncidentModel> {
  const connection = await getCoworkDb();
  return registerIncidentModel(connection);
}
