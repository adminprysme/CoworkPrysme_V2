import { connectMongo } from "../../connection.js";
import { getReservationModel } from "../reservation/reservation.schema.js";

export interface ExpiredAwaitingPaymentReservation {
  reservationId: string;
  reference: string;
  awaitingPaymentMethod?: "card" | "bank_transfer";
  stripePaymentIntentId?: string;
  clientAccountId?: string;
  buildingId?: string;
  spaceName?: string;
}

export interface ExpireAwaitingPaymentReservationsResult {
  expired: ExpiredAwaitingPaymentReservation[];
}

/**
 * Soft-cancels awaiting_payment holds past `awaitingPaymentExpiresAt`.
 * Returns cancelled rows so the caller can cancel Stripe PIs and/or email clients.
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
    .select({
      reference: 1,
      stripePaymentIntentId: 1,
      awaitingPaymentMethod: 1,
      clientAccountId: 1,
      buildingId: 1,
      spaceSnapshot: 1,
    })
    .lean()
    .exec();

  const expired: ExpiredAwaitingPaymentReservation[] = [];

  for (const candidate of candidates) {
    const methodBeforeCancel = candidate.awaitingPaymentMethod as
      "card" | "bank_transfer" | undefined;

    const updated = await Reservation.findOneAndUpdate(
      {
        _id: candidate._id,
        status: "awaiting_payment",
        awaitingPaymentExpiresAt: { $lte: now },
      },
      {
        $set: { status: "cancelled" },
        $unset: { awaitingPaymentExpiresAt: 1, awaitingPaymentMethod: 1 },
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
      // Read from candidate: awaitingPaymentMethod is unset on the updated doc.
      awaitingPaymentMethod: methodBeforeCancel,
      stripePaymentIntentId: updated.stripePaymentIntentId || undefined,
      clientAccountId: updated.clientAccountId?.toString(),
      buildingId: updated.buildingId?.toString(),
      spaceName: candidate.spaceSnapshot?.name,
    });
  }

  return { expired };
}
