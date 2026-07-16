import type { Types } from "mongoose";

import { connectMongo } from "../../connection.js";
import {
  getReservationModel,
  type ReservationDocument,
} from "../reservation/reservation.schema.js";

export interface ConfirmReservationAfterPaymentInput {
  reservationId: Types.ObjectId | string;
  confirmedAt?: Date;
  /** statusHistory reason — defaults to stripe_payment_succeeded for card path. */
  reason?: string;
}

export interface ConfirmReservationAfterPaymentResult {
  /** false when the reservation was already confirmed (idempotent replay). */
  transitioned: boolean;
  reservation: ReservationDocument;
}

/**
 * Moves an awaiting_payment reservation to confirmed after payment is applied.
 * Idempotent if already confirmed. Clears awaiting-payment fields.
 */
export async function confirmReservationAfterPayment(
  input: ConfirmReservationAfterPaymentInput,
): Promise<ConfirmReservationAfterPaymentResult> {
  await connectMongo();
  const Reservation = await getReservationModel();
  const confirmedAt = input.confirmedAt ?? new Date();
  const reason = input.reason ?? "stripe_payment_succeeded";

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
      $unset: {
        awaitingPaymentExpiresAt: 1,
        awaitingPaymentMethod: 1,
        stripePaymentIntentId: 1,
      },
      $push: {
        statusHistory: {
          from: "awaiting_payment",
          to: "confirmed",
          at: confirmedAt,
          reason,
        },
      },
    },
    { returnDocument: "after" },
  ).exec();

  if (!updated) {
    const reloaded = await Reservation.findById(input.reservationId).exec();
    if (!reloaded) {
      throw new Error(`Reservation not found after confirm race: ${input.reservationId}`);
    }
    return { transitioned: false, reservation: reloaded };
  }

  return { transitioned: true, reservation: updated };
}

/** @deprecated Prefer confirmReservationAfterPayment — kept for existing Stripe callers. */
export async function confirmReservationAfterCardPayment(
  input: Omit<ConfirmReservationAfterPaymentInput, "reason">,
): Promise<ConfirmReservationAfterPaymentResult> {
  return confirmReservationAfterPayment({
    ...input,
    reason: "stripe_payment_succeeded",
  });
}
