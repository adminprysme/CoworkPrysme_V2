import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { INVOICE_STATUSES, INVOICE_TYPES, PAYMENT_SITUATIONS } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { DEFAULT_CURRENCY, objectIdRef, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";
import {
  billingLineSchema,
  invoiceTotalsSchema,
  vatBreakdownLineSchema,
  type BillingLine,
  type InvoiceTotals,
  type VatBreakdownLine,
} from "../../lib/subdocuments.js";

export interface Invoice {
  reference: string;
  currency: string;
  type: (typeof INVOICE_TYPES)[number];
  cardexId: Types.ObjectId;
  reservationId?: Types.ObjectId;
  lines: BillingLine[];
  vatBreakdown: VatBreakdownLine[];
  totals: InvoiceTotals;
  paymentSituation: (typeof PAYMENT_SITUATIONS)[number];
  status: (typeof INVOICE_STATUSES)[number];
  dueDate?: Date;
  pdfStorageKey?: string;
  issuedAt?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InvoiceDocument = HydratedDocument<Invoice>;

const invoiceSchema = new Schema<Invoice>(
  {
    reference: { type: String, required: true },
    currency: { type: String, default: DEFAULT_CURRENCY, required: true },
    type: { type: String, enum: INVOICE_TYPES, required: true },
    cardexId: objectIdRef("Cardex"),
    reservationId: { type: Schema.Types.ObjectId, ref: "Reservation" },
    lines: { type: [billingLineSchema], default: [] },
    vatBreakdown: { type: [vatBreakdownLineSchema], default: [] },
    totals: { type: invoiceTotalsSchema, required: true },
    paymentSituation: { type: String, enum: PAYMENT_SITUATIONS, required: true },
    status: { type: String, enum: INVOICE_STATUSES, required: true },
    dueDate: { type: Date },
    pdfStorageKey: { type: String },
    issuedAt: { type: Date },
    paidAt: { type: Date },
  },
  { ...TIMESTAMP_OPTIONS, collection: "invoices" },
);

invoiceSchema.index({ reference: 1 }, { unique: true });
invoiceSchema.index({ cardexId: 1, issuedAt: -1 });
invoiceSchema.index({ status: 1, dueDate: 1 });

export type InvoiceModel = Model<Invoice>;

export function registerInvoiceModel(connection: Connection): InvoiceModel {
  return registerModel(connection, "Invoice", invoiceSchema);
}

export async function getInvoiceModel(): Promise<InvoiceModel> {
  const connection = await getCoworkDb();
  return registerInvoiceModel(connection);
}
