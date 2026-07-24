import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { QUOTE_PAYMENT_LINK_STATUSES, type QuotePaymentLinkStatus } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { objectIdRef, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";

/**
 * Persisted Stripe payment-link for a quote-derived invoice (Option B — custom /payer-devis).
 * Token stored as hash only (QUOTE_PAYMENT_LINK_TOKEN_SECRET).
 * Membership: invoiceId + quoteId must match on redeem → uniform 404 otherwise.
 */
export interface QuotePaymentLink {
  /** SHA-256(token + ":" + QUOTE_PAYMENT_LINK_TOKEN_SECRET) — never store raw token. */
  tokenHash: string;
  quoteId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  reservationIds: Types.ObjectId[];
  cardexId: Types.ObjectId;
  status: QuotePaymentLinkStatus;
  /** Aligned to Quote.validUntil (LOCKED #6). */
  expiresAt: Date;
  /** Deposit TTC or full TTC snapshot at link creation (LOCKED #5). */
  amountDueCentsSnapshot: number;
  stripePaymentIntentId?: string;
  consumedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type QuotePaymentLinkDocument = HydratedDocument<QuotePaymentLink>;

const quotePaymentLinkSchema = new Schema<QuotePaymentLink>(
  {
    tokenHash: { type: String, required: true },
    quoteId: objectIdRef("Quote"),
    invoiceId: objectIdRef("Invoice"),
    reservationIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Reservation" }],
      required: true,
      validate: {
        validator: (v: Types.ObjectId[]) => Array.isArray(v) && v.length > 0,
        message: "reservationIds must be a non-empty array",
      },
    },
    cardexId: objectIdRef("Cardex"),
    status: {
      type: String,
      enum: QUOTE_PAYMENT_LINK_STATUSES,
      default: "active",
      required: true,
    },
    expiresAt: { type: Date, required: true },
    amountDueCentsSnapshot: { type: Number, required: true, min: 1 },
    stripePaymentIntentId: { type: String },
    consumedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { ...TIMESTAMP_OPTIONS, collection: "quotePaymentLinks" },
);

quotePaymentLinkSchema.index({ tokenHash: 1 }, { unique: true });
quotePaymentLinkSchema.index({ invoiceId: 1, quoteId: 1 });
quotePaymentLinkSchema.index({ quoteId: 1, status: 1 });
quotePaymentLinkSchema.index({ status: 1, expiresAt: 1 });

export type QuotePaymentLinkModel = Model<QuotePaymentLink>;

export function registerQuotePaymentLinkModel(connection: Connection): QuotePaymentLinkModel {
  return registerModel(connection, "QuotePaymentLink", quotePaymentLinkSchema);
}

export async function getQuotePaymentLinkModel(): Promise<QuotePaymentLinkModel> {
  const connection = await getCoworkDb();
  return registerQuotePaymentLinkModel(connection);
}
