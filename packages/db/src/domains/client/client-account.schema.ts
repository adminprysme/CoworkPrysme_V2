import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { CLIENT_ACCOUNT_STATUSES } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { optionalObjectIdRef, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";
import {
  consentRecordSchema,
  marketingConsentRecordSchema,
  type ConsentRecord,
  type MarketingConsentRecord,
} from "../../lib/subdocuments.js";

export interface ClientAccount {
  email: string;
  passwordHash: string;
  cardexId?: Types.ObjectId;
  emailVerifiedAt?: Date;
  consent: ConsentRecord;
  marketingConsent?: MarketingConsentRecord;
  status: (typeof CLIENT_ACCOUNT_STATUSES)[number];
  createdAt: Date;
  updatedAt: Date;
}

export type ClientAccountDocument = HydratedDocument<ClientAccount>;

const clientAccountSchema = new Schema<ClientAccount>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    cardexId: optionalObjectIdRef("Cardex"),
    emailVerifiedAt: { type: Date },
    consent: { type: consentRecordSchema, required: true },
    marketingConsent: { type: marketingConsentRecordSchema, required: false },
    status: { type: String, enum: CLIENT_ACCOUNT_STATUSES, default: "active", required: true },
  },
  { ...TIMESTAMP_OPTIONS, collection: "clientAccounts" },
);

clientAccountSchema.index({ email: 1 }, { unique: true });

export type ClientAccountModel = Model<ClientAccount>;

export function registerClientAccountModel(connection: Connection): ClientAccountModel {
  return registerModel(connection, "ClientAccount", clientAccountSchema);
}

export async function getClientAccountModel(): Promise<ClientAccountModel> {
  const connection = await getCoworkDb();
  return registerClientAccountModel(connection);
}
