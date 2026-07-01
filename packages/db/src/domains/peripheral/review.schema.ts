import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { REVIEW_SOURCES, REVIEW_STATUSES } from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { optionalObjectIdRef, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";

export interface Review {
  cardexId?: Types.ObjectId;
  author: string;
  rating: number;
  text: string;
  source: (typeof REVIEW_SOURCES)[number];
  publishedAt?: Date;
  status: (typeof REVIEW_STATUSES)[number];
  createdAt: Date;
  updatedAt: Date;
}

export type ReviewDocument = HydratedDocument<Review>;

const reviewSchema = new Schema<Review>(
  {
    cardexId: optionalObjectIdRef("Cardex"),
    author: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true },
    source: { type: String, enum: REVIEW_SOURCES, required: true },
    publishedAt: { type: Date },
    status: { type: String, enum: REVIEW_STATUSES, default: "pending", required: true },
  },
  { ...TIMESTAMP_OPTIONS, collection: "reviews" },
);

reviewSchema.index({ status: 1, publishedAt: -1 });

export type ReviewModel = Model<Review>;

export function registerReviewModel(connection: Connection): ReviewModel {
  return registerModel(connection, "Review", reviewSchema);
}

export async function getReviewModel(): Promise<ReviewModel> {
  const connection = await getCoworkDb();
  return registerReviewModel(connection);
}
