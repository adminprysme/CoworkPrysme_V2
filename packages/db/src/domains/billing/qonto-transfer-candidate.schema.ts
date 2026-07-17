import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { registerModel } from "../../lib/register-model.js";
import {
  centsField,
  DEFAULT_CURRENCY,
  optionalObjectIdRef,
  TIMESTAMP_OPTIONS,
} from "../../lib/schema-helpers.js";

export const QONTO_CANDIDATE_MATCH_STATUSES = [
  "exact",
  "amount_mismatch",
  "no_reservation",
] as const;

export type QontoCandidateMatchStatus = (typeof QONTO_CANDIDATE_MATCH_STATUSES)[number];

/**
 * Minimal Qonto credit snapshot for staff suggestions.
 * No third-party IBAN — only ids, amounts, dates, and label text needed to match RES-….
 */
export interface QontoTransferCandidate {
  qontoTxId: string;
  amountCents: number;
  currency: string;
  settledAt: Date | null;
  observedLabel: string;
  reservationReference: string | null;
  matchStatus: QontoCandidateMatchStatus;
  invoiceId?: Types.ObjectId;
  reservationId?: Types.ObjectId;
  amountDueCents?: number;
  /** Set when staff confirmed mark-received with this qontoTxId. */
  consumedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type QontoTransferCandidateDocument = HydratedDocument<QontoTransferCandidate>;

const qontoTransferCandidateSchema = new Schema<QontoTransferCandidate>(
  {
    qontoTxId: { type: String, required: true },
    amountCents: centsField({ min: 0 }),
    currency: { type: String, default: DEFAULT_CURRENCY, required: true },
    settledAt: { type: Date, default: null },
    observedLabel: { type: String, required: true, default: "" },
    reservationReference: { type: String, default: null },
    matchStatus: {
      type: String,
      enum: QONTO_CANDIDATE_MATCH_STATUSES,
      required: true,
    },
    invoiceId: optionalObjectIdRef("Invoice"),
    reservationId: optionalObjectIdRef("Reservation"),
    amountDueCents: centsField({ required: false, min: 0 }),
    consumedAt: { type: Date },
  },
  { ...TIMESTAMP_OPTIONS, collection: "qontoTransferCandidates" },
);

qontoTransferCandidateSchema.index({ qontoTxId: 1 }, { unique: true });
qontoTransferCandidateSchema.index({ reservationReference: 1, consumedAt: 1 });
qontoTransferCandidateSchema.index({ matchStatus: 1, consumedAt: 1 });

export type QontoTransferCandidateModel = Model<QontoTransferCandidate>;

export function registerQontoTransferCandidateModel(
  connection: Connection,
): QontoTransferCandidateModel {
  return registerModel(connection, "QontoTransferCandidate", qontoTransferCandidateSchema);
}

export async function getQontoTransferCandidateModel(): Promise<QontoTransferCandidateModel> {
  const connection = await getCoworkDb();
  return registerQontoTransferCandidateModel(connection);
}
