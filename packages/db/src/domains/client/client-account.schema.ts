import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import {
  CLIENT_ACCOUNT_ROLES,
  CLIENT_ACCOUNT_STATUSES,
  type ClientAccountRole,
} from "../../lib/enums.js";
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
  /**
   * owner = referenced by Cardex.clientAccountId for that dossier;
   * member = collaborator attached via invitation (same cardexId).
   * Permissions are equal for now — field reserved for future client space.
   */
  role: ClientAccountRole;
  emailVerifiedAt?: Date;
  consent: ConsentRecord;
  marketingConsent?: MarketingConsentRecord;
  /** active | locked (staff-deactivated) | anonymized (future RGPD). */
  status: (typeof CLIENT_ACCOUNT_STATUSES)[number];
  /** Set when status becomes locked (staff deactivate). Cleared on reactivate. */
  lockedAt?: Date;
  lockedByStaffProfileId?: Types.ObjectId;
  /** Optional staff motive — not required. */
  lockReason?: string;
  unlockedAt?: Date;
  unlockedByStaffProfileId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ClientAccountDocument = HydratedDocument<ClientAccount>;

const clientAccountSchema = new Schema<ClientAccount>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    cardexId: optionalObjectIdRef("Cardex"),
    role: { type: String, enum: CLIENT_ACCOUNT_ROLES, required: true },
    emailVerifiedAt: { type: Date },
    consent: { type: consentRecordSchema, required: true },
    marketingConsent: { type: marketingConsentRecordSchema, required: false },
    status: { type: String, enum: CLIENT_ACCOUNT_STATUSES, default: "active", required: true },
    lockedAt: { type: Date },
    lockedByStaffProfileId: optionalObjectIdRef("StaffProfile"),
    lockReason: { type: String, trim: true, maxlength: 500 },
    unlockedAt: { type: Date },
    unlockedByStaffProfileId: optionalObjectIdRef("StaffProfile"),
  },
  { ...TIMESTAMP_OPTIONS, collection: "clientAccounts" },
);

clientAccountSchema.index({ email: 1 }, { unique: true });
clientAccountSchema.index({ cardexId: 1, role: 1 });
clientAccountSchema.index({ cardexId: 1, status: 1 });

export type ClientAccountModel = Model<ClientAccount>;

export function registerClientAccountModel(connection: Connection): ClientAccountModel {
  return registerModel(connection, "ClientAccount", clientAccountSchema);
}

export async function getClientAccountModel(): Promise<ClientAccountModel> {
  const connection = await getCoworkDb();
  return registerClientAccountModel(connection);
}
