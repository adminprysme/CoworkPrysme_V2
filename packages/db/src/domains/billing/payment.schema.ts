import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { PAYMENT_KINDS, PAYMENT_METHODS } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import {
  centsField,
  DEFAULT_CURRENCY,
  objectIdRef,
  TIMESTAMP_OPTIONS,
} from "../../lib/schema-helpers.js";
import { reconciliationSchema, type ReconciliationInfo } from "../../lib/subdocuments.js";

export interface Payment {
  currency: string;
  invoiceId: Types.ObjectId;
  cardexId: Types.ObjectId;
  kind: (typeof PAYMENT_KINDS)[number];
  method: (typeof PAYMENT_METHODS)[number];
  amount: number;
  reconciliation: ReconciliationInfo;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentDocument = HydratedDocument<Payment>;

const paymentSchema = new Schema<Payment>(
  {
    currency: { type: String, default: DEFAULT_CURRENCY, required: true },
    invoiceId: objectIdRef("Invoice"),
    cardexId: objectIdRef("Cardex"),
    kind: { type: String, enum: PAYMENT_KINDS, required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    amount: centsField({ min: 0 }),
    reconciliation: { type: reconciliationSchema, required: true },
    receivedAt: { type: Date, required: true },
  },
  { ...TIMESTAMP_OPTIONS, collection: "payments" },
);

paymentSchema.index({ invoiceId: 1 });
paymentSchema.index({ "reconciliation.status": 1 });

export type PaymentModel = Model<Payment>;

export function registerPaymentModel(connection: Connection): PaymentModel {
  return registerModel(connection, "Payment", paymentSchema);
}

export async function getPaymentModel(): Promise<PaymentModel> {
  const connection = await getCoworkDb();
  return registerPaymentModel(connection);
}
