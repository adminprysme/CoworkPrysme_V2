import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { RETENTION_STATUSES } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { objectIdRef, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";
import {
  addressSchema,
  billingSummarySchema,
  cardexCompanySchema,
  cardexDocumentMetaSchema,
  cardexIdentitySchema,
  type Address,
  type BillingSummary,
  type CardexCompany,
  type CardexDocumentMeta,
  type CardexIdentity,
} from "../../lib/subdocuments.js";

export interface Cardex {
  clientAccountId: Types.ObjectId;
  identity: CardexIdentity;
  /** Postal / billing address for individual (particulier) clients. */
  address?: Address;
  company?: CardexCompany;
  documents: CardexDocumentMeta[];
  preferentialCodeIds: Types.ObjectId[];
  billingSummary: BillingSummary;
  lastReservationAt?: Date;
  retentionStatus: (typeof RETENTION_STATUSES)[number];
  anonymizedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CardexDocument = HydratedDocument<Cardex>;

const cardexSchema = new Schema<Cardex>(
  {
    clientAccountId: objectIdRef("ClientAccount"),
    identity: { type: cardexIdentitySchema, required: true },
    address: { type: addressSchema },
    company: { type: cardexCompanySchema },
    documents: { type: [cardexDocumentMetaSchema], default: [] },
    preferentialCodeIds: [{ type: Schema.Types.ObjectId, ref: "DiscountCode" }],
    billingSummary: {
      type: billingSummarySchema,
      default: () => ({ depositsTotal: 0, balanceDue: 0 }),
    },
    lastReservationAt: { type: Date },
    retentionStatus: { type: String, enum: RETENTION_STATUSES, default: "active", required: true },
    anonymizedAt: { type: Date },
  },
  { ...TIMESTAMP_OPTIONS, collection: "cardex" },
);

cardexSchema.index({ clientAccountId: 1 }, { unique: true });
cardexSchema.index({ lastReservationAt: 1 });
cardexSchema.index({ "company.siret": 1 });

export type CardexModel = Model<Cardex>;

export function registerCardexModel(connection: Connection): CardexModel {
  return registerModel(connection, "Cardex", cardexSchema);
}

export async function getCardexModel(): Promise<CardexModel> {
  const connection = await getCoworkDb();
  return registerCardexModel(connection);
}
