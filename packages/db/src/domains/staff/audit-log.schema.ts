import { Schema, type Connection, type HydratedDocument, type Model } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { registerModel } from "../../lib/register-model.js";
import { TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";
import {
  auditActorSchema,
  auditDiffSchema,
  auditEntitySchema,
  type AuditActor,
  type AuditEntity,
} from "../../lib/subdocuments.js";

export interface AuditLog {
  actor: AuditActor;
  action: string;
  entity: AuditEntity;
  diff?: Record<string, { before: unknown; after: unknown }>;
  reason?: string;
  at: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;

const IMMUTABLE_ERROR = "AuditLog documents are immutable and cannot be modified after insertion";

const auditLogSchema = new Schema<AuditLog>(
  {
    actor: { type: auditActorSchema, required: true },
    action: { type: String, required: true },
    entity: { type: auditEntitySchema, required: true },
    diff: { type: auditDiffSchema },
    reason: { type: String },
    at: { type: Date, required: true, default: Date.now },
  },
  { ...TIMESTAMP_OPTIONS, collection: "auditLogs" },
);

auditLogSchema.index({ "entity.type": 1, "entity.id": 1, at: -1 });
auditLogSchema.index({ "actor.id": 1, at: -1 });

auditLogSchema.pre("save", function auditLogImmutableSave() {
  if (!this.isNew) {
    throw new Error(IMMUTABLE_ERROR);
  }
});

for (const hook of [
  "updateOne",
  "findOneAndUpdate",
  "updateMany",
  "replaceOne",
  "deleteOne",
  "deleteMany",
] as const) {
  auditLogSchema.pre(hook, function auditLogImmutableMutation() {
    throw new Error(IMMUTABLE_ERROR);
  });
}

export type AuditLogModel = Model<AuditLog>;

export function registerAuditLogModel(connection: Connection): AuditLogModel {
  return registerModel(connection, "AuditLog", auditLogSchema);
}

export async function getAuditLogModel(): Promise<AuditLogModel> {
  const connection = await getCoworkDb();
  return registerAuditLogModel(connection);
}
