import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { connectMongo, getCoworkDb } from "../../connection.js";
import { confirmReservationAfterCardPayment } from "../../domains/booking/index.js";
import {
  createReservation,
  ensureReservationIndexes,
  getReservationModel,
  registerReservationModel,
  registerSlotLockModel,
} from "../../domains/reservation/index.js";
import {
  clearCoworkCollections,
  configureIntegrationEnv,
  startIntegrationMongo,
  stopIntegrationMongo,
} from "./setup.js";

describe("confirmReservationAfterCardPayment", () => {
  beforeAll(async () => {
    const uri = await startIntegrationMongo();
    await configureIntegrationEnv(uri);
    await connectMongo();
    const connection = await getCoworkDb();
    registerSlotLockModel(connection);
    registerReservationModel(connection);
    await ensureReservationIndexes();
  }, 120_000);

  afterEach(async () => {
    await clearCoworkCollections();
  });

  afterAll(async () => {
    await stopIntegrationMongo();
  });

  it("transitions awaiting_payment to confirmed and clears expiry", async () => {
    const reservation = await createReservation({
      reference: "RES-2026-90001",
      spaceId: new Types.ObjectId(),
      spaceSnapshot: { name: "Salle A", type: "meeting_room" },
      buildingId: new Types.ObjectId(),
      type: "meeting_room",
      startAt: new Date("2026-07-01T10:00:00.000Z"),
      endAt: new Date("2026-07-01T11:00:00.000Z"),
      durationClass: "hourly",
      partySize: 4,
      status: "awaiting_payment",
      statusHistory: [{ from: "pending", to: "awaiting_payment", at: new Date() }],
      services: [],
      pricing: { subtotalHT: 5000, totalVAT: 1000, totalTTC: 6000, discountTotal: 0 },
      awaitingPaymentExpiresAt: new Date(Date.now() + 45 * 60 * 1000),
      createdChannel: "online",
    });

    const result = await confirmReservationAfterCardPayment({
      reservationId: reservation._id,
    });

    expect(result.transitioned).toBe(true);
    expect(result.reservation.status).toBe("confirmed");
    expect(result.reservation.awaitingPaymentExpiresAt).toBeUndefined();

    const Reservation = await getReservationModel();
    const stored = await Reservation.findById(reservation._id).lean().exec();
    expect(stored?.status).toBe("confirmed");
    expect(stored?.awaitingPaymentExpiresAt).toBeUndefined();
  });

  it("is idempotent when already confirmed", async () => {
    const reservation = await createReservation({
      reference: "RES-2026-90002",
      spaceId: new Types.ObjectId(),
      spaceSnapshot: { name: "Salle A", type: "meeting_room" },
      buildingId: new Types.ObjectId(),
      type: "meeting_room",
      startAt: new Date("2026-07-01T12:00:00.000Z"),
      endAt: new Date("2026-07-01T13:00:00.000Z"),
      durationClass: "hourly",
      partySize: 2,
      status: "confirmed",
      statusHistory: [{ from: "awaiting_payment", to: "confirmed", at: new Date() }],
      services: [],
      pricing: { subtotalHT: 5000, totalVAT: 1000, totalTTC: 6000, discountTotal: 0 },
      createdChannel: "online",
    });

    const result = await confirmReservationAfterCardPayment({
      reservationId: reservation._id,
    });

    expect(result.transitioned).toBe(false);
    expect(result.reservation.status).toBe("confirmed");
  });
});
