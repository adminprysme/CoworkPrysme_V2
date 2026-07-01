import type { ClientSession, Types } from "mongoose";

import { connectMongo, getCoworkDb } from "../../connection.js";
import { BLOCKING_RESERVATION_STATUSES } from "../../lib/enums.js";
import { ReservationOverlapError } from "../../lib/errors.js";
import { assertReplicaSetForTransactions } from "../../lib/replica-set.js";
import {
  getReservationModel,
  type Reservation,
  type ReservationDocument,
} from "./reservation.schema.js";

export type CreateReservationInput = Omit<Reservation, "createdAt" | "updatedAt">;

async function findOverlappingReservation(
  spaceId: Types.ObjectId,
  startAt: Date,
  endAt: Date,
  session: ClientSession,
): Promise<ReservationDocument | null> {
  const Reservation = await getReservationModel();
  return Reservation.findOne({
    spaceId,
    status: { $in: BLOCKING_RESERVATION_STATUSES },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  })
    .session(session)
    .exec();
}

/**
 * Creates a reservation atomically after verifying no pending/confirmed overlap exists.
 * Requires a MongoDB replica set — fails fast otherwise.
 */
export async function createReservation(
  input: CreateReservationInput,
): Promise<ReservationDocument> {
  const mongooseInstance = await connectMongo();
  await assertReplicaSetForTransactions(mongooseInstance.connection);

  const session = await mongooseInstance.startSession();
  try {
    let created: ReservationDocument | undefined;

    await session.withTransaction(async () => {
      const overlap = await findOverlappingReservation(
        input.spaceId,
        input.startAt,
        input.endAt,
        session,
      );
      if (overlap) {
        throw new ReservationOverlapError();
      }

      const Reservation = await getReservationModel();
      const [doc] = await Reservation.create([input], { session });
      created = doc;
    });

    if (!created) {
      throw new Error("Reservation creation failed within transaction");
    }
    return created;
  } finally {
    await session.endSession();
  }
}

/** Ensures cowork indexes exist — useful in tests after model registration. */
export async function ensureReservationIndexes(): Promise<void> {
  const connection = await getCoworkDb();
  const Reservation = connection.models.Reservation;
  const SlotLock = connection.models.SlotLock;
  if (Reservation) {
    await Reservation.syncIndexes();
  }
  if (SlotLock) {
    await SlotLock.syncIndexes();
  }
}
