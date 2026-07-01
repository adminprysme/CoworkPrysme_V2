import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import {
  CREATED_CHANNELS,
  DURATION_CLASSES,
  RESERVATION_STATUSES,
  RESERVATION_TYPES,
} from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { objectIdRef, optionalObjectIdRef, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";
import {
  reservationPricingSnapshotSchema,
  reservationServiceSnapshotSchema,
  spaceSnapshotSchema,
  statusHistoryEntrySchema,
  type ReservationPricingSnapshot,
  type ReservationServiceSnapshot,
  type SpaceSnapshot,
  type StatusHistoryEntry,
} from "../../lib/subdocuments.js";

export interface Reservation {
  reference: string;
  spaceId: Types.ObjectId;
  spaceSnapshot: SpaceSnapshot;
  buildingId: Types.ObjectId;
  clientAccountId?: Types.ObjectId;
  cardexId?: Types.ObjectId;
  type: (typeof RESERVATION_TYPES)[number];
  startAt: Date;
  endAt: Date;
  durationClass: (typeof DURATION_CLASSES)[number];
  partySize: number;
  status: (typeof RESERVATION_STATUSES)[number];
  statusHistory: StatusHistoryEntry[];
  services: ReservationServiceSnapshot[];
  discountCodeId?: Types.ObjectId;
  pricing: ReservationPricingSnapshot;
  cgvAcceptedAt?: Date;
  createdChannel: (typeof CREATED_CHANNELS)[number];
  createdAt: Date;
  updatedAt: Date;
}

export type ReservationDocument = HydratedDocument<Reservation>;

const reservationSchema = new Schema<Reservation>(
  {
    reference: { type: String, required: true },
    spaceId: objectIdRef("Space"),
    spaceSnapshot: { type: spaceSnapshotSchema, required: true },
    buildingId: objectIdRef("Building"),
    clientAccountId: optionalObjectIdRef("ClientAccount"),
    cardexId: optionalObjectIdRef("Cardex"),
    type: { type: String, enum: RESERVATION_TYPES, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    durationClass: { type: String, enum: DURATION_CLASSES, required: true },
    partySize: { type: Number, required: true, min: 1 },
    status: { type: String, enum: RESERVATION_STATUSES, required: true },
    statusHistory: { type: [statusHistoryEntrySchema], default: [] },
    services: { type: [reservationServiceSnapshotSchema], default: [] },
    discountCodeId: optionalObjectIdRef("DiscountCode"),
    pricing: { type: reservationPricingSnapshotSchema, required: true },
    cgvAcceptedAt: { type: Date },
    createdChannel: { type: String, enum: CREATED_CHANNELS, required: true },
  },
  { ...TIMESTAMP_OPTIONS, collection: "reservations" },
);

reservationSchema.index({ spaceId: 1, startAt: 1, endAt: 1, status: 1 });
reservationSchema.index({ cardexId: 1, startAt: -1 });
reservationSchema.index({ reference: 1 }, { unique: true });

export type ReservationModel = Model<Reservation>;

export function registerReservationModel(connection: Connection): ReservationModel {
  return registerModel(connection, "Reservation", reservationSchema);
}

export async function getReservationModel(): Promise<ReservationModel> {
  const connection = await getCoworkDb();
  return registerReservationModel(connection);
}
