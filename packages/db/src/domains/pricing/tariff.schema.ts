import { Schema, type Connection, type HydratedDocument, type Model } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { DURATION_CLASSES, TARIFF_STATUSES } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { centsField, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";
import { tariffScopeSchema, type TariffScope } from "../../lib/subdocuments.js";

export interface Tariff {
  scope: TariffScope;
  durationClass: (typeof DURATION_CLASSES)[number];
  priceHT: number;
  vatRate: number;
  subscription?: Record<string, unknown>;
  validFrom: Date;
  validTo?: Date;
  status: (typeof TARIFF_STATUSES)[number];
  createdAt: Date;
  updatedAt: Date;
}

export type TariffDocument = HydratedDocument<Tariff>;

const tariffSchema = new Schema<Tariff>(
  {
    scope: { type: tariffScopeSchema, required: true, default: {} },
    durationClass: { type: String, enum: DURATION_CLASSES, required: true },
    priceHT: centsField({ min: 0 }),
    vatRate: { type: Number, required: true },
    subscription: { type: Schema.Types.Mixed },
    validFrom: { type: Date, required: true },
    validTo: { type: Date },
    status: { type: String, enum: TARIFF_STATUSES, default: "active", required: true },
  },
  { ...TIMESTAMP_OPTIONS, collection: "tariffs" },
);

tariffSchema.index({ "scope.spaceId": 1, durationClass: 1, status: 1 });

export type TariffModel = Model<Tariff>;

export function registerTariffModel(connection: Connection): TariffModel {
  return registerModel(connection, "Tariff", tariffSchema);
}

export async function getTariffModel(): Promise<TariffModel> {
  const connection = await getCoworkDb();
  return registerTariffModel(connection);
}
