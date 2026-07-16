import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { connectMongo, getCoworkDb } from "../../connection.js";
import { expireAwaitingPaymentReservations } from "../../domains/booking/index.js";
import {
  createReservation,
  ensureReservationIndexes,
  getReservationModel,
  registerReservationModel,
  registerSlotLockModel,
} from "../../domains/reservation/index.js";
import { findOverlappingReservation } from "../../domains/reservation/availability.js";
import {
  clearCoworkCollections,
  configureIntegrationEnv,
  startIntegrationMongo,
  stopIntegrationMongo,
} from "./setup.js";

describe("expireAwaitingPaymentReservations", () => {
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

  it("cancels expired awaiting_payment holds and frees the slot", async () => {
    const spaceId = new Types.ObjectId();
    const startAt = new Date("2026-07-01T10:00:00.000Z");
    const endAt = new Date("2026-07-01T11:00:00.000Z");
    const now = new Date("2026-07-01T10:00:00.000Z");

    await createReservation({
      reference: "RES-2026-80001",
      spaceId,
      spaceSnapshot: { name: "Salle A", type: "meeting_room" },
      buildingId: new Types.ObjectId(),
      type: "meeting_room",
      startAt,
      endAt,
      durationClass: "hourly",
      partySize: 4,
      status: "awaiting_payment",
      statusHistory: [{ from: "pending", to: "awaiting_payment", at: now }],
      services: [],
      pricing: { subtotalHT: 5000, totalVAT: 1000, totalTTC: 6000, discountTotal: 0 },
      awaitingPaymentExpiresAt: new Date(now.getTime() - 1000),
      stripePaymentIntentId: "pi_expired_hold",
      createdChannel: "online",
    });

    // Still blocking before expiry sweep.
    await expect(findOverlappingReservation(spaceId, startAt, endAt)).resolves.toBeTruthy();

    const result = await expireAwaitingPaymentReservations(now);
    expect(result.expired).toHaveLength(1);
    expect(result.expired[0]?.stripePaymentIntentId).toBe("pi_expired_hold");
    expect(result.expired[0]?.reference).toBe("RES-2026-80001");

    const Reservation = await getReservationModel();
    const stored = await Reservation.findOne({ reference: "RES-2026-80001" }).lean().exec();
    expect(stored?.status).toBe("cancelled");
    expect(stored?.awaitingPaymentExpiresAt).toBeUndefined();

    // Slot free after cancel.
    await expect(findOverlappingReservation(spaceId, startAt, endAt)).resolves.toBeNull();
  });

  it("does not expire non-expired awaiting_payment reservations", async () => {
    const now = new Date("2026-07-01T10:00:00.000Z");
    await createReservation({
      reference: "RES-2026-80002",
      spaceId: new Types.ObjectId(),
      spaceSnapshot: { name: "Salle A", type: "meeting_room" },
      buildingId: new Types.ObjectId(),
      type: "meeting_room",
      startAt: new Date("2026-07-01T12:00:00.000Z"),
      endAt: new Date("2026-07-01T13:00:00.000Z"),
      durationClass: "hourly",
      partySize: 2,
      status: "awaiting_payment",
      statusHistory: [{ from: "pending", to: "awaiting_payment", at: now }],
      services: [],
      pricing: { subtotalHT: 5000, totalVAT: 1000, totalTTC: 6000, discountTotal: 0 },
      awaitingPaymentExpiresAt: new Date(now.getTime() + 45 * 60 * 1000),
      createdChannel: "online",
    });

    const result = await expireAwaitingPaymentReservations(now);
    expect(result.expired).toHaveLength(0);

    const Reservation = await getReservationModel();
    const stored = await Reservation.findOne({ reference: "RES-2026-80002" }).lean().exec();
    expect(stored?.status).toBe("awaiting_payment");
  });
});
