import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { DISCOUNT_CODE_KINDS, DISCOUNT_CODE_STATUSES, DISCOUNT_TYPES } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { optionalObjectIdRef, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";
import { discountPerimeterSchema, type DiscountPerimeter } from "../../lib/subdocuments.js";

export interface DiscountCode {
  code: string;
  kind: (typeof DISCOUNT_CODE_KINDS)[number];
  discountType: (typeof DISCOUNT_TYPES)[number];
  value: number;
  perimeter: DiscountPerimeter;
  cardexId?: Types.ObjectId;
  stackable: boolean;
  startsAt?: Date;
  expiresAt: Date;
  maxUses?: number;
  usedCount: number;
  status: (typeof DISCOUNT_CODE_STATUSES)[number];
  createdAt: Date;
  updatedAt: Date;
}

export type DiscountCodeDocument = HydratedDocument<DiscountCode>;

const discountCodeSchema = new Schema<DiscountCode>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    kind: { type: String, enum: DISCOUNT_CODE_KINDS, required: true },
    discountType: { type: String, enum: DISCOUNT_TYPES, required: true },
    value: { type: Number, required: true },
    perimeter: { type: discountPerimeterSchema, required: true },
    cardexId: optionalObjectIdRef("Cardex"),
    stackable: { type: Boolean, default: false, required: true },
    startsAt: { type: Date },
    expiresAt: { type: Date, required: true },
    maxUses: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0, required: true, min: 0 },
    status: { type: String, enum: DISCOUNT_CODE_STATUSES, default: "active", required: true },
  },
  { ...TIMESTAMP_OPTIONS, collection: "discountCodes" },
);

discountCodeSchema.index({ code: 1 }, { unique: true });
discountCodeSchema.index({ cardexId: 1 });
discountCodeSchema.index({ expiresAt: 1 });
discountCodeSchema.index({ startsAt: 1 });

export type DiscountCodeModel = Model<DiscountCode>;

export function registerDiscountCodeModel(connection: Connection): DiscountCodeModel {
  return registerModel(connection, "DiscountCode", discountCodeSchema);
}

export async function getDiscountCodeModel(): Promise<DiscountCodeModel> {
  const connection = await getCoworkDb();
  return registerDiscountCodeModel(connection);
}
