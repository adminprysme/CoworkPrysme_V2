import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import {
  CLIENT_ACCOUNT_INVITATION_STATUSES,
  type ClientAccountInvitationStatus,
} from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { objectIdRef, optionalObjectIdRef, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";

/**
 * Staff-issued invitation for a collaborator to create a ClientAccount
 * attached to an existing cardex (role=member). Token is stored as hash only.
 */
export interface ClientAccountInvitation {
  cardexId: Types.ObjectId;
  email: string;
  /** SHA-256(token + ":" + CLIENT_INVITE_TOKEN_SECRET) — never store raw token. */
  tokenHash: string;
  status: ClientAccountInvitationStatus;
  expiresAt: Date;
  invitedByStaffProfileId: Types.ObjectId;
  /** Planning reservation context when invite was created from Contacts. */
  reservationId?: Types.ObjectId;
  acceptedClientAccountId?: Types.ObjectId;
  acceptedAt?: Date;
  revokedAt?: Date;
  revokedByStaffProfileId?: Types.ObjectId;
  lastSentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ClientAccountInvitationDocument = HydratedDocument<ClientAccountInvitation>;

const clientAccountInvitationSchema = new Schema<ClientAccountInvitation>(
  {
    cardexId: objectIdRef("Cardex"),
    email: { type: String, required: true, lowercase: true, trim: true },
    tokenHash: { type: String, required: true },
    status: {
      type: String,
      enum: CLIENT_ACCOUNT_INVITATION_STATUSES,
      default: "pending",
      required: true,
    },
    expiresAt: { type: Date, required: true },
    invitedByStaffProfileId: objectIdRef("StaffProfile"),
    reservationId: optionalObjectIdRef("Reservation"),
    acceptedClientAccountId: optionalObjectIdRef("ClientAccount"),
    acceptedAt: { type: Date },
    revokedAt: { type: Date },
    revokedByStaffProfileId: optionalObjectIdRef("StaffProfile"),
    lastSentAt: { type: Date, required: true },
  },
  { ...TIMESTAMP_OPTIONS, collection: "clientAccountInvitations" },
);

clientAccountInvitationSchema.index({ tokenHash: 1 }, { unique: true });
clientAccountInvitationSchema.index(
  { cardexId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  },
);
clientAccountInvitationSchema.index({ status: 1, expiresAt: 1 });
clientAccountInvitationSchema.index({ reservationId: 1, createdAt: -1 });

export type ClientAccountInvitationModel = Model<ClientAccountInvitation>;

export function registerClientAccountInvitationModel(
  connection: Connection,
): ClientAccountInvitationModel {
  return registerModel(connection, "ClientAccountInvitation", clientAccountInvitationSchema);
}

export async function getClientAccountInvitationModel(): Promise<ClientAccountInvitationModel> {
  const connection = await getCoworkDb();
  return registerClientAccountInvitationModel(connection);
}
