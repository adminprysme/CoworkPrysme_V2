import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { PAYMENT_SITUATIONS, QUOTE_PAYMENT_METHODS, QUOTE_STATUSES } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import {
  DEFAULT_CURRENCY,
  centsField,
  optionalObjectIdRef,
  TIMESTAMP_OPTIONS,
} from "../../lib/schema-helpers.js";
import {
  billingTotalsSchema,
  quoteAcceptedBySchema,
  quoteLineSchema,
  quoteProspectSchema,
  vatBreakdownLineSchema,
  type BillingTotals,
  type QuoteAcceptedBy,
  type QuoteLine,
  type QuoteProspect,
  type VatBreakdownLine,
} from "../../lib/subdocuments.js";

export interface Quote {
  reference: string;
  currency: string;
  /** Optional until accept / staff bootstrap — does not block send. */
  cardexId?: Types.ObjectId;
  /** Principal contact; optional until accept / bootstrap. */
  clientAccountId?: Types.ObjectId;
  /**
   * Identity before cardex exists (send without cardex).
   * Alias product name: clientDraft — field name is `prospect`.
   */
  prospect?: QuoteProspect;
  /** @deprecated Prefer `reservationIds` (Option A multi-space). Kept for read compat. */
  reservationId?: Types.ObjectId;
  /** Filled at accept — N reservations (Option A). */
  reservationIds: Types.ObjectId[];
  lines: QuoteLine[];
  vatBreakdown: VatBreakdownLine[];
  totals: BillingTotals;
  /** 0–100; server derives deposit amounts. */
  depositPercent: number;
  depositAmountHT?: number;
  depositAmountTTC?: number;
  /** TVA ventilation of the deposit (LOCKED #4 — for invoice PDF). */
  depositVatBreakdown?: VatBreakdownLine[];
  paymentSituation?: (typeof PAYMENT_SITUATIONS)[number];
  paymentMethodPreferred?: (typeof QUOTE_PAYMENT_METHODS)[number];
  status: (typeof QUOTE_STATUSES)[number];
  validUntil: Date;
  /** Staff-only — never on client PDF/email. */
  internalNote?: string;
  publicConditions?: string;
  paymentTermsLabel?: string;
  sentAt?: Date;
  acceptedAt?: Date;
  refusedAt?: Date;
  expiredAt?: Date;
  createdByStaffProfileId?: Types.ObjectId;
  acceptTokenHash?: string;
  /** Aligned with min(validUntil, now+30d) at token issue (LOCKED product b). */
  acceptTokenExpiresAt?: Date;
  acceptedBy?: QuoteAcceptedBy;
  createdAt: Date;
  updatedAt: Date;
}

export type QuoteDocument = HydratedDocument<Quote>;

const quoteSchema = new Schema<Quote>(
  {
    reference: { type: String, required: true },
    currency: { type: String, default: DEFAULT_CURRENCY, required: true },
    cardexId: optionalObjectIdRef("Cardex"),
    clientAccountId: optionalObjectIdRef("ClientAccount"),
    prospect: { type: quoteProspectSchema, required: false },
    reservationId: { type: Schema.Types.ObjectId, ref: "Reservation" },
    reservationIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Reservation" }],
      default: [],
    },
    lines: { type: [quoteLineSchema], default: [] },
    vatBreakdown: { type: [vatBreakdownLineSchema], default: [] },
    totals: { type: billingTotalsSchema, required: true },
    depositPercent: { type: Number, required: true, min: 0, max: 100, default: 0 },
    depositAmountHT: centsField({ required: false, min: 0 }),
    depositAmountTTC: centsField({ required: false, min: 0 }),
    depositVatBreakdown: { type: [vatBreakdownLineSchema], default: undefined },
    paymentSituation: { type: String, enum: PAYMENT_SITUATIONS },
    paymentMethodPreferred: { type: String, enum: QUOTE_PAYMENT_METHODS },
    status: { type: String, enum: QUOTE_STATUSES, required: true },
    validUntil: { type: Date, required: true },
    internalNote: { type: String, trim: true, maxlength: 5000 },
    publicConditions: { type: String, trim: true, maxlength: 10000 },
    paymentTermsLabel: { type: String, trim: true, maxlength: 500 },
    sentAt: { type: Date },
    acceptedAt: { type: Date },
    refusedAt: { type: Date },
    expiredAt: { type: Date },
    createdByStaffProfileId: optionalObjectIdRef("StaffProfile"),
    acceptTokenHash: { type: String, trim: true },
    acceptTokenExpiresAt: { type: Date },
    acceptedBy: { type: quoteAcceptedBySchema, required: false },
  },
  { ...TIMESTAMP_OPTIONS, collection: "quotes" },
);

quoteSchema.index({ reference: 1 }, { unique: true });
quoteSchema.index({ cardexId: 1, createdAt: -1 });
quoteSchema.index({ status: 1, validUntil: 1 });
quoteSchema.index({ acceptTokenHash: 1 }, { unique: true, sparse: true });

export type QuoteModel = Model<Quote>;

export function registerQuoteModel(connection: Connection): QuoteModel {
  return registerModel(connection, "Quote", quoteSchema);
}

export async function getQuoteModel(): Promise<QuoteModel> {
  const connection = await getCoworkDb();
  return registerQuoteModel(connection);
}
