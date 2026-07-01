import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { QUOTE_STATUSES } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { DEFAULT_CURRENCY, objectIdRef, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";
import {
  billingLineSchema,
  billingTotalsSchema,
  vatBreakdownLineSchema,
  type BillingLine,
  type BillingTotals,
  type VatBreakdownLine,
} from "../../lib/subdocuments.js";

export interface Quote {
  reference: string;
  currency: string;
  cardexId: Types.ObjectId;
  reservationId?: Types.ObjectId;
  lines: BillingLine[];
  vatBreakdown: VatBreakdownLine[];
  totals: BillingTotals;
  status: (typeof QUOTE_STATUSES)[number];
  validUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type QuoteDocument = HydratedDocument<Quote>;

const quoteSchema = new Schema<Quote>(
  {
    reference: { type: String, required: true },
    currency: { type: String, default: DEFAULT_CURRENCY, required: true },
    cardexId: objectIdRef("Cardex"),
    reservationId: { type: Schema.Types.ObjectId, ref: "Reservation" },
    lines: { type: [billingLineSchema], default: [] },
    vatBreakdown: { type: [vatBreakdownLineSchema], default: [] },
    totals: { type: billingTotalsSchema, required: true },
    status: { type: String, enum: QUOTE_STATUSES, required: true },
    validUntil: { type: Date, required: true },
  },
  { ...TIMESTAMP_OPTIONS, collection: "quotes" },
);

quoteSchema.index({ reference: 1 }, { unique: true });

export type QuoteModel = Model<Quote>;

export function registerQuoteModel(connection: Connection): QuoteModel {
  return registerModel(connection, "Quote", quoteSchema);
}

export async function getQuoteModel(): Promise<QuoteModel> {
  const connection = await getCoworkDb();
  return registerQuoteModel(connection);
}
