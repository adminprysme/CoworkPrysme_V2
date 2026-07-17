import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { connectMongo, getCoworkDb } from "../../connection.js";
import {
  acquireLock,
  assertRangeAvailable,
  createReservation,
  ensureReservationIndexes,
  findActiveLockBySessionId,
  findOverlappingActiveLock,
  registerReservationModel,
  registerSlotLockGateModel,
  registerSlotLockModel,
  releaseLockById,
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
    registerSlotLockGateModel(connection);
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

    it("rejects acquireLock when intervals overlap even if tuples differ (10:00-11:00 vs 10:30-11:30)", async () => {
      const spaceId = new Types.ObjectId();
      const firstStart = new Date("2026-07-01T10:00:00.000Z");
      const firstEnd = new Date("2026-07-01T11:00:00.000Z");
      const overlapStart = new Date("2026-07-01T10:30:00.000Z");
      const overlapEnd = new Date("2026-07-01T11:30:00.000Z");

      await acquireLock({
        spaceId,
        startAt: firstStart,
        endAt: firstEnd,
        sessionId: "session-a",
      });

      const overlappingLock = await findOverlappingActiveLock(spaceId, overlapStart, overlapEnd);
      expect(overlappingLock).not.toBeNull();

      await expect(
        acquireLock({
          spaceId,
          startAt: overlapStart,
          endAt: overlapEnd,
          sessionId: "session-b",
        }),
      ).rejects.toBeInstanceOf(SlotLockConflictError);

      await expect(
        assertRangeAvailable({
          spaceId,
          buildingId: new Types.ObjectId(),
          spaceType: "meeting_room",
          openingHours: [],
          startAt: overlapStart,
          endAt: overlapEnd,
        }),
      ).rejects.toMatchObject({ name: "SlotUnavailableError" });
    });

    it("allows only one success when two overlapping acquireLock run concurrently", async () => {
      const spaceId = new Types.ObjectId();
      const results = await Promise.allSettled([
        acquireLock({
          spaceId,
          startAt: new Date("2026-07-01T10:00:00.000Z"),
          endAt: new Date("2026-07-01T11:00:00.000Z"),
          sessionId: "concurrent-a",
        }),
        acquireLock({
          spaceId,
          startAt: new Date("2026-07-01T10:30:00.000Z"),
          endAt: new Date("2026-07-01T11:30:00.000Z"),
          sessionId: "concurrent-b",
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.status).toBe("rejected");
      if (rejected[0]?.status === "rejected") {
        expect(rejected[0].reason).toBeInstanceOf(SlotLockConflictError);
      }

      const surviving = await findOverlappingActiveLock(
        spaceId,
        new Date("2026-07-01T10:00:00.000Z"),
        new Date("2026-07-01T11:30:00.000Z"),
      );
      expect(surviving).not.toBeNull();
    });

    it("releaseLockById only deletes locks owned by the session", async () => {
      const spaceId = new Types.ObjectId();
      const startAt = new Date("2026-07-01T10:00:00.000Z");
      const endAt = new Date("2026-07-01T11:00:00.000Z");

      const lock = await acquireLock({ spaceId, startAt, endAt, sessionId: "owner-session" });

      await expect(releaseLockById(lock._id, "other-session")).resolves.toBe(false);
      await expect(releaseLockById(lock._id, "owner-session")).resolves.toBe(true);
    });

    it("findActiveLockBySessionId returns the newest valid lock for the session", async () => {
      const spaceId = new Types.ObjectId();
      const firstStart = new Date("2026-07-01T10:00:00.000Z");
      const firstEnd = new Date("2026-07-01T11:00:00.000Z");
      const secondStart = new Date("2026-07-02T10:00:00.000Z");
      const secondEnd = new Date("2026-07-02T11:00:00.000Z");

      await acquireLock({
        spaceId,
        startAt: firstStart,
        endAt: firstEnd,
        sessionId: "resume-session",
        partySize: 2,
        durationClass: "hourly",
      });
      await acquireLock({
        spaceId,
        startAt: secondStart,
        endAt: secondEnd,
        sessionId: "resume-session",
        partySize: 4,
        durationClass: "daily",
      });

      const active = await findActiveLockBySessionId("resume-session");
      expect(active).not.toBeNull();
      expect(active?.partySize).toBe(4);
      expect(active?.durationClass).toBe("daily");
      expect(active?.startAt.toISOString()).toBe(secondStart.toISOString());
    });

    it("findActiveLockBySessionId returns null for another session", async () => {
      const spaceId = new Types.ObjectId();
      const startAt = new Date("2026-07-01T10:00:00.000Z");
      const endAt = new Date("2026-07-01T11:00:00.000Z");

      await acquireLock({ spaceId, startAt, endAt, sessionId: "owner-session" });

      await expect(findActiveLockBySessionId("other-session")).resolves.toBeNull();
    });

    it("findActiveLockBySessionId returns null once the lock has expired", async () => {
      const spaceId = new Types.ObjectId();
      const startAt = new Date("2026-07-01T10:00:00.000Z");
      const endAt = new Date("2026-07-01T11:00:00.000Z");
      const now = new Date("2026-07-01T09:00:00.000Z");

      await acquireLock({ spaceId, startAt, endAt, sessionId: "expired-session", now });

      const expiredAt = new Date(now.getTime() + 10 * 60 * 1000 + 1);
      await expect(findActiveLockBySessionId("expired-session", expiredAt)).resolves.toBeNull();
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

    it("refuses a reservation that overlaps an awaiting_payment booking", async () => {
      const input = {
        ...baseInput(),
        status: "awaiting_payment" as const,
        awaitingPaymentExpiresAt: new Date(Date.now() + 45 * 60 * 1000),
      };
      await createReservation(input);

      const overlapping = {
        ...baseInput(),
        spaceId: input.spaceId,
        buildingId: input.buildingId,
        reference: `RES-2026-${Math.random().toString(36).slice(2, 8)}`,
        startAt: new Date("2026-07-01T10:30:00.000Z"),
        endAt: new Date("2026-07-01T11:30:00.000Z"),
        status: "confirmed" as const,
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
