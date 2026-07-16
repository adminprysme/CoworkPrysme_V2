import { connectMongo } from "../../connection.js";
import { getReservationModel } from "../reservation/reservation.schema.js";

export interface ExpiredAwaitingPaymentReservation {
  reservationId: string;
  reference: string;
  stripePaymentIntentId?: string;
}

export interface ExpireAwaitingPaymentReservationsResult {
  expired: ExpiredAwaitingPaymentReservation[];
}

/**
 * Soft-cancels card holds past `awaitingPaymentExpiresAt`.
 * Returns cancelled rows (with optional Stripe PI id) so the caller can cancel PaymentIntents.
 */
export async function expireAwaitingPaymentReservations(
  now: Date = new Date(),
): Promise<ExpireAwaitingPaymentReservationsResult> {
  await connectMongo();
  const Reservation = await getReservationModel();

  const candidates = await Reservation.find({
    status: "awaiting_payment",
    awaitingPaymentExpiresAt: { $lte: now },
  })
    .select({ reference: 1, stripePaymentIntentId: 1 })
    .lean()
    .exec();

  const expired: ExpiredAwaitingPaymentReservation[] = [];

  for (const candidate of candidates) {
    const updated = await Reservation.findOneAndUpdate(
      {
        _id: candidate._id,
        status: "awaiting_payment",
        awaitingPaymentExpiresAt: { $lte: now },
      },
      {
        $set: { status: "cancelled" },
        $unset: { awaitingPaymentExpiresAt: 1 },
        $push: {
          statusHistory: {
            from: "awaiting_payment",
            to: "cancelled",
            at: now,
            reason: "awaiting_payment_expired",
          },
        },
      },
      { returnDocument: "after" },
    )
      .lean()
      .exec();

    if (!updated) {
      continue;
    }

    expired.push({
      reservationId: updated._id.toString(),
      reference: updated.reference,
      stripePaymentIntentId: updated.stripePaymentIntentId || undefined,
    });
  }

  return { expired };
}
