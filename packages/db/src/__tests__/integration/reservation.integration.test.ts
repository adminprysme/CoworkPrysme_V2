import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { connectMongo, getCoworkDb } from "../../connection.js";
import {
  acquireLock,
  createReservation,
  ensureReservationIndexes,
  registerReservationModel,
  registerSlotLockModel,
} from "../../domains/reservation/index.js";
import { ReservationOverlapError, SlotLockConflictError } from "../../lib/errors.js";
import {
  clearCoworkCollections,
  configureIntegrationEnv,
  startIntegrationMongo,
  stopIntegrationMongo,
} from "./setup.js";

describe("integration: reservation core (replica set)", () => {
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

  describe("slot locks", () => {
    it("rejects a second acquireLock on the same slot (duplicate key)", async () => {
      const spaceId = new Types.ObjectId();
      const startAt = new Date("2026-07-01T10:00:00.000Z");
      const endAt = new Date("2026-07-01T11:00:00.000Z");

      await acquireLock({ spaceId, startAt, endAt, sessionId: "session-a" });

      await expect(
        acquireLock({ spaceId, startAt, endAt, sessionId: "session-b" }),
      ).rejects.toBeInstanceOf(SlotLockConflictError);
    });
  });

  describe("reservation anti-overlap", () => {
    const baseInput = () => {
      const spaceId = new Types.ObjectId();
      const buildingId = new Types.ObjectId();
      return {
        reference: `RES-2026-${Math.random().toString(36).slice(2, 8)}`,
        spaceId,
        spaceSnapshot: { name: "Salle A", type: "meeting_room" },
        buildingId,
        type: "meeting_room" as const,
        startAt: new Date("2026-07-01T10:00:00.000Z"),
        endAt: new Date("2026-07-01T11:00:00.000Z"),
        durationClass: "hourly" as const,
        partySize: 4,
        status: "confirmed" as const,
        statusHistory: [],
        services: [],
        pricing: { subtotalHT: 5000, totalVAT: 1000, totalTTC: 6000, discountTotal: 0 },
        createdChannel: "online" as const,
      };
    };

    it("refuses a reservation that overlaps a pending/confirmed booking", async () => {
      const input = baseInput();
      await createReservation(input);

      const overlapping = {
        ...baseInput(),
        spaceId: input.spaceId,
        buildingId: input.buildingId,
        reference: `RES-2026-${Math.random().toString(36).slice(2, 8)}`,
        startAt: new Date("2026-07-01T10:30:00.000Z"),
        endAt: new Date("2026-07-01T11:30:00.000Z"),
        status: "pending" as const,
      };

      await expect(createReservation(overlapping)).rejects.toBeInstanceOf(ReservationOverlapError);
    });

    it("allows a reservation when existing booking is cancelled", async () => {
      const input = { ...baseInput(), status: "cancelled" as const };
      await createReservation(input);

      const next = {
        ...baseInput(),
        spaceId: input.spaceId,
        buildingId: input.buildingId,
        reference: `RES-2026-${Math.random().toString(36).slice(2, 8)}`,
      };

      await expect(createReservation(next)).resolves.toBeDefined();
    });
  });
});
