import { Schema, type Connection, type HydratedDocument, type Model } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { NEWS_OFFER_KINDS, NEWS_OFFER_STATUSES } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";

export interface NewsOffer {
  title: string;
  body: string;
  kind: (typeof NEWS_OFFER_KINDS)[number];
  publishedFrom?: Date;
  publishedTo?: Date;
  status: (typeof NEWS_OFFER_STATUSES)[number];
  createdAt: Date;
  updatedAt: Date;
}

export type NewsOfferDocument = HydratedDocument<NewsOffer>;

const newsOfferSchema = new Schema<NewsOffer>(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    kind: { type: String, enum: NEWS_OFFER_KINDS, required: true },
    publishedFrom: { type: Date },
    publishedTo: { type: Date },
    status: { type: String, enum: NEWS_OFFER_STATUSES, default: "draft", required: true },
  },
  { ...TIMESTAMP_OPTIONS, collection: "newsOffers" },
);

newsOfferSchema.index({ status: 1, publishedFrom: 1, publishedTo: 1 });

export type NewsOfferModel = Model<NewsOffer>;

export function registerNewsOfferModel(connection: Connection): NewsOfferModel {
  return registerModel(connection, "NewsOffer", newsOfferSchema);
}

export async function getNewsOfferModel(): Promise<NewsOfferModel> {
  const connection = await getCoworkDb();
  return registerNewsOfferModel(connection);
}
