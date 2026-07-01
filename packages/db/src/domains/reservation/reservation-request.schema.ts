import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import {
  CREATED_CHANNELS,
  RESERVATION_REQUEST_STATUSES,
  RESERVATION_REQUEST_TYPES,
} from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { optionalObjectIdRef, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";
import {
  reservationRequestContactSchema,
  type ReservationRequestContact,
} from "../../lib/subdocuments.js";

export interface ReservationRequest {
  type: (typeof RESERVATION_REQUEST_TYPES)[number];
  buildingId?: Types.ObjectId;
  spaceId?: Types.ObjectId;
  spaceType?: string;
  contact: ReservationRequestContact;
  clientAccountId?: Types.ObjectId;
  cardexId?: Types.ObjectId;
  preferredStartAt?: Date;
  preferredEndAt?: Date;
  message?: string;
  status: (typeof RESERVATION_REQUEST_STATUSES)[number];
  createdChannel: (typeof CREATED_CHANNELS)[number];
  createdAt: Date;
  updatedAt: Date;
}

export type ReservationRequestDocument = HydratedDocument<ReservationRequest>;

const reservationRequestSchema = new Schema<ReservationRequest>(
  {
    type: { type: String, enum: RESERVATION_REQUEST_TYPES, required: true },
    buildingId: optionalObjectIdRef("Building"),
    spaceId: optionalObjectIdRef("Space"),
    spaceType: { type: String },
    contact: { type: reservationRequestContactSchema, required: true },
    clientAccountId: optionalObjectIdRef("ClientAccount"),
    cardexId: optionalObjectIdRef("Cardex"),
    preferredStartAt: { type: Date },
    preferredEndAt: { type: Date },
    message: { type: String },
    status: {
      type: String,
      enum: RESERVATION_REQUEST_STATUSES,
      default: "pending",
      required: true,
    },
    createdChannel: { type: String, enum: CREATED_CHANNELS, required: true },
  },
  { ...TIMESTAMP_OPTIONS, collection: "reservationRequests" },
);

reservationRequestSchema.index({ status: 1, createdAt: -1 });
reservationRequestSchema.index({ "contact.email": 1 });

export type ReservationRequestModel = Model<ReservationRequest>;

export function registerReservationRequestModel(connection: Connection): ReservationRequestModel {
  return registerModel(connection, "ReservationRequest", reservationRequestSchema);
}

export async function getReservationRequestModel(): Promise<ReservationRequestModel> {
  const connection = await getCoworkDb();
  return registerReservationRequestModel(connection);
}
