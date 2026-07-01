import { Schema, type Connection, type HydratedDocument, type Model, type Types } from "mongoose";

import { getCoworkDb } from "../../connection.js";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TEMPLATES,
} from "../../lib/enums.js";
import { registerModel } from "../../lib/register-model.js";
import { optionalObjectIdRef, TIMESTAMP_OPTIONS } from "../../lib/schema-helpers.js";

export interface Notification {
  cardexId?: Types.ObjectId;
  reservationId?: Types.ObjectId;
  template: (typeof NOTIFICATION_TEMPLATES)[number];
  channel: (typeof NOTIFICATION_CHANNELS)[number];
  scheduledFor: Date;
  sentAt?: Date;
  status: (typeof NOTIFICATION_STATUSES)[number];
  payloadSnapshot?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;

const notificationSchema = new Schema<Notification>(
  {
    cardexId: optionalObjectIdRef("Cardex"),
    reservationId: optionalObjectIdRef("Reservation"),
    template: { type: String, enum: NOTIFICATION_TEMPLATES, required: true },
    channel: { type: String, enum: NOTIFICATION_CHANNELS, default: "email", required: true },
    scheduledFor: { type: Date, required: true },
    sentAt: { type: Date },
    status: { type: String, enum: NOTIFICATION_STATUSES, default: "pending", required: true },
    payloadSnapshot: { type: Schema.Types.Mixed },
  },
  { ...TIMESTAMP_OPTIONS, collection: "notifications" },
);

notificationSchema.index({ status: 1, scheduledFor: 1 });

export type NotificationModel = Model<Notification>;

export function registerNotificationModel(connection: Connection): NotificationModel {
  return registerModel(connection, "Notification", notificationSchema);
}

export async function getNotificationModel(): Promise<NotificationModel> {
  const connection = await getCoworkDb();
  return registerNotificationModel(connection);
}
