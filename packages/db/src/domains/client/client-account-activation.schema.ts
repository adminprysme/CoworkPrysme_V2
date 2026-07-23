import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import {
  CLIENT_ACCOUNT_ACTIVATION_STATUSES,
  type ClientAccountActivationStatus,
} from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { objectIdRef, optionalObjectIdRef, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";

/**
 * Password-set token after devis staff-accept bootstrap (pending_activation).
 * Distinct from collaborator invitations — never reuse invite tokens/secrets.
 */
export interface ClientAccountActivation {
  clientAccountId: Types.ObjectId;
  /** Denormalized for public preview — same email as the ClientAccount. */
  email: string;
  /** SHA-256(token + ":" + CLIENT_ACCOUNT_ACTIVATION_TOKEN_SECRET). */
  tokenHash: string;
  status: ClientAccountActivationStatus;
  expiresAt: Date;
  /** Quote that triggered staff-accept bootstrap, when applicable. */
  quoteId?: Types.ObjectId;
  issuedByStaffProfileId?: Types.ObjectId;
  consumedAt?: Date;
  revokedAt?: Date;
  lastSentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ClientAccountActivationDocument = HydratedDocument<ClientAccountActivation>;

const clientAccountActivationSchema = new Schema<ClientAccountActivation>(
  {
    clientAccountId: objectIdRef("ClientAccount"),
    email: { type: String, required: true, lowercase: true, trim: true },
    tokenHash: { type: String, required: true },
    status: {
      type: String,
      enum: CLIENT_ACCOUNT_ACTIVATION_STATUSES,
      default: "pending",
      required: true,
    },
    expiresAt: { type: Date, required: true },
    quoteId: optionalObjectIdRef("Quote"),
    issuedByStaffProfileId: optionalObjectIdRef("StaffProfile"),
    consumedAt: { type: Date },
    revokedAt: { type: Date },
    lastSentAt: { type: Date, required: true },
  },
  { ...TIMESTAMP_OPTIONS, collection: "clientAccountActivations" },
);

clientAccountActivationSchema.index({ tokenHash: 1 }, { unique: true });
clientAccountActivationSchema.index(
  { clientAccountId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  },
);
clientAccountActivationSchema.index({ status: 1, expiresAt: 1 });

export type ClientAccountActivationModel = Model<ClientAccountActivation>;

export function registerClientAccountActivationModel(
  connection: Connection,
): ClientAccountActivationModel {
  return registerModel(connection, "ClientAccountActivation", clientAccountActivationSchema);
}

export async function getClientAccountActivationModel(): Promise<ClientAccountActivationModel> {
  const connection = await getCoworkDb();
  return registerClientAccountActivationModel(connection);
}
