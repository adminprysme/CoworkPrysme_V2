import type { Types } from "mongoose";

import { connectMongo } from "../../connection.js";
import {
  getReservationModel,
  type ReservationDocument,
} from "../reservation/reservation.schema.js";

export interface ConfirmReservationAfterCardPaymentInput {
  reservationId: Types.ObjectId | string;
  confirmedAt?: Date;
}

export interface ConfirmReservationAfterCardPaymentResult {
  /** false when the reservation was already confirmed (idempotent replay). */
  transitioned: boolean;
  reservation: ReservationDocument;
}

/**
 * Moves a card-checkout reservation from `awaiting_payment` to `confirmed`
 * after Stripe `payment_intent.succeeded`. Idempotent if already confirmed.
 */
export async function confirmReservationAfterCardPayment(
  input: ConfirmReservationAfterCardPaymentInput,
): Promise<ConfirmReservationAfterCardPaymentResult> {
  await connectMongo();
  const Reservation = await getReservationModel();
  const confirmedAt = input.confirmedAt ?? new Date();

  const existing = await Reservation.findById(input.reservationId).exec();
  if (!existing) {
    throw new Error(`Reservation not found: ${input.reservationId}`);
  }

  if (existing.status === "confirmed") {
    return { transitioned: false, reservation: existing };
  }

  if (existing.status !== "awaiting_payment") {
    throw new Error(
      `Cannot confirm reservation ${existing.reference} from status ${existing.status}`,
    );
  }

  const updated = await Reservation.findOneAndUpdate(
    { _id: existing._id, status: "awaiting_payment" },
    {
      $set: { status: "confirmed" },
      $unset: { awaitingPaymentExpiresAt: 1 },
      $push: {
        statusHistory: {
          from: "awaiting_payment",
          to: "confirmed",
          at: confirmedAt,
          reason: "stripe_payment_succeeded",
        },
      },
    },
    { returnDocument: "after" },
  ).exec();

  if (!updated) {
    // Concurrent confirm won the race — reload.
    const reloaded = await Reservation.findById(input.reservationId).exec();
    if (!reloaded) {
      throw new Error(`Reservation not found after confirm race: ${input.reservationId}`);
    }
    return { transitioned: false, reservation: reloaded };
  }

  return { transitioned: true, reservation: updated };
}
