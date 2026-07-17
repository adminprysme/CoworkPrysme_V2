import { Schema, type Connection, type HydratedDocument, type Model } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { registerModel } from "../../lib/register-model.js";
import { TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";

/**
 * Encrypted Qonto OAuth tokens (single-org). Refresh tokens rotate on every use —
 * never store them only in env.
 */
export interface QontoOAuthCredential {
  /** Singleton key — always "default" for the single Cowork org. */
  key: string;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  /** Cached bank account id from GET /v2/organization (optional). */
  bankAccountId?: string;
  /** Short-lived OAuth CSRF state during bootstrap. */
  pendingOAuthState?: string;
  pendingOAuthStateExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type QontoOAuthCredentialDocument = HydratedDocument<QontoOAuthCredential>;

const qontoOAuthCredentialSchema = new Schema<QontoOAuthCredential>(
  {
    key: { type: String, required: true, default: "default" },
    accessTokenEnc: { type: String, required: true },
    refreshTokenEnc: { type: String, required: true },
    accessTokenExpiresAt: { type: Date, required: true },
    refreshTokenExpiresAt: { type: Date, required: true },
    bankAccountId: { type: String },
    pendingOAuthState: { type: String },
    pendingOAuthStateExpiresAt: { type: Date },
  },
  { ...TIMESTAMP_OPTIONS, collection: "qontoOAuthCredentials" },
);

qontoOAuthCredentialSchema.index({ key: 1 }, { unique: true });

export type QontoOAuthCredentialModel = Model<QontoOAuthCredential>;

export function registerQontoOAuthCredentialModel(
  connection: Connection,
): QontoOAuthCredentialModel {
  return registerModel(connection, "QontoOAuthCredential", qontoOAuthCredentialSchema);
}

export async function getQontoOAuthCredentialModel(): Promise<QontoOAuthCredentialModel> {
  const connection = await getCoworkDb();
  return registerQontoOAuthCredentialModel(connection);
}

export const QONTO_OAUTH_SINGLETON_KEY = "default" as const;
