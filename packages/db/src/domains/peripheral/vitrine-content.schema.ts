import { Schema, type Connection, type HydratedDocument, type Model } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import { registerModel } from "../../lib/register-model.js";
import { TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";

export interface VitrineServiceImages {
  roomService: string | null;
  afterwork: string | null;
  conciergerie: string | null;
}

export interface VitrineMarquee {
  enabled: boolean;
  text: string;
}

export interface VitrineContentDocumentData {
  _id: string;
  heroImages: string[];
  conceptImage: string | null;
  serviceImages: VitrineServiceImages;
  featuredSpaceIds: string[];
  marquee: VitrineMarquee;
  createdAt: Date;
  updatedAt: Date;
}

export type VitrineContentDocument = HydratedDocument<VitrineContentDocumentData>;

const vitrineServiceImagesSchema = new Schema<VitrineServiceImages>(
  {
    roomService: { type: String, default: null },
    afterwork: { type: String, default: null },
    conciergerie: { type: String, default: null },
  },
  { _id: false },
);

const vitrineMarqueeSchema = new Schema<VitrineMarquee>(
  {
    enabled: { type: Boolean, default: true, required: true },
    text: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const vitrineContentSchema = new Schema<VitrineContentDocumentData>(
  {
    _id: { type: String, required: true },
    heroImages: { type: [String], default: [] },
    conceptImage: { type: String, default: null },
    serviceImages: { type: vitrineServiceImagesSchema, required: true },
    featuredSpaceIds: { type: [String], default: [] },
    marquee: { type: vitrineMarqueeSchema, required: true },
  },
  { ...TIMESTAMP_OPTIONS, collection: "vitrineContent" },
);

export function registerVitrineContentModel(
  connection: Connection,
): Model<VitrineContentDocumentData> {
  return registerModel(connection, "VitrineContent", vitrineContentSchema);
}

export async function getVitrineContentModel(): Promise<Model<VitrineContentDocumentData>> {
  const connection = await getCoworkDb();
  return registerVitrineContentModel(connection);
}
