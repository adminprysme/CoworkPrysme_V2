import { Schema } from "mongoose";

export const SERVICE_CUSTOM_QUESTION_TYPES = [
  "short_text",
  "long_text",
  "number",
  "select",
  "datetime",
  "date_range",
  "datetime_range",
] as const;

export type ServiceCustomQuestionType = (typeof SERVICE_CUSTOM_QUESTION_TYPES)[number];

export interface ServiceCustomQuestion {
  id: string;
  label: string;
  type: ServiceCustomQuestionType;
  required: boolean;
  options?: string[];
  order: number;
}

export const serviceCustomQuestionSchema = new Schema<ServiceCustomQuestion>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: SERVICE_CUSTOM_QUESTION_TYPES, required: true },
    required: { type: Boolean, required: true, default: false },
    options: { type: [String], default: undefined },
    order: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);
