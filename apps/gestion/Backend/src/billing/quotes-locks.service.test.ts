import { ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  connectMongoMock,
  getSpaceModelMock,
  acquireLocksForSessionMock,
  releaseLocksBySessionIdMock,
  refreshLocksBySessionIdMock,
  findActiveLocksBySessionIdMock,
  assertRangeAvailableMock,
  fetchRangeBlockingCacheMock,
  isRangeBlockedWithCacheMock,
  validateRangeAccessibilityMock,
  buildStaffQuoteLockSessionIdMock,
  SlotLockConflictErrorMock,
} = vi.hoisted(() => {
  class SlotLockConflictError extends Error {
    constructor() {
      super("conflict");
      this.name = "SlotLockConflictError";
    }
  }
  return {
    connectMongoMock: vi.fn(),
    getSpaceModelMock: vi.fn(),
    acquireLocksForSessionMock: vi.fn(),
    releaseLocksBySessionIdMock: vi.fn(),
    refreshLocksBySessionIdMock: vi.fn(),
    findActiveLocksBySessionIdMock: vi.fn(),
    assertRangeAvailableMock: vi.fn(),
    fetchRangeBlockingCacheMock: vi.fn(),
    isRangeBlockedWithCacheMock: vi.fn(),
    validateRangeAccessibilityMock: vi.fn(),
    buildStaffQuoteLockSessionIdMock: vi.fn(
      (staffId: string, quoteId: string) => `staff-quote:${staffId}:${quoteId}`,
    ),
    SlotLockConflictErrorMock: SlotLockConflictError,
  };
});

vi.mock("@coworkprysme/db", () => ({
  connectMongo: connectMongoMock,
  getSpaceModel: getSpaceModelMock,
  acquireLocksForSession: acquireLocksForSessionMock,
  releaseLocksBySessionId: releaseLocksBySessionIdMock,
  refreshLocksBySessionId: refreshLocksBySessionIdMock,
  findActiveLocksBySessionId: findActiveLocksBySessionIdMock,
  assertRangeAvailable: assertRangeAvailableMock,
  fetchRangeBlockingCache: fetchRangeBlockingCacheMock,
  isRangeBlockedWithCache: isRangeBlockedWithCacheMock,
  validateRangeAccessibility: validateRangeAccessibilityMock,
  buildStaffQuoteLockSessionId: buildStaffQuoteLockSessionIdMock,
  SLOT_LOCK_DURATION_MS: 10 * 60 * 1000,
  SlotLockConflictError: SlotLockConflictErrorMock,
  SlotUnavailableError: class SlotUnavailableError extends Error {
    constructor() {
      super("unavailable");
      this.name = "SlotUnavailableError";
    }
  },
  RangeOpeningHoursError: class RangeOpeningHoursError extends Error {
    closedDays: string[];
    constructor(closedDays: string[]) {
      super("hours");
      this.name = "RangeOpeningHoursError";
      this.closedDays = closedDays;
    }
  },
}));

import { QuotesLocksService } from "./quotes-locks.service.js";

const STAFF_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const QUOTE_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const SPACE_A = "cccccccccccccccccccccccc";
const SPACE_B = "dddddddddddddddddddddddd";

function staffProfile() {
  return { _id: STAFF_ID, permissions: { billing: true } } as never;
}

function spaceDoc(id: string, capacity = 10) {
  return {
    _id: id,
    buildingId: "eeeeeeeeeeeeeeeeeeeeeeee",
    type: "meeting_room",
    capacity,
    openingHours: [],
  };
}

describe("QuotesLocksService", () => {
  let service: QuotesLocksService;

  beforeEach(() => {
    vi.clearAllMocks();
    connectMongoMock.mockResolvedValue(undefined);
    releaseLocksBySessionIdMock.mockResolvedValue(0);
    assertRangeAvailableMock.mockResolvedValue(undefined);
    validateRangeAccessibilityMock.mockReturnValue({ valid: true });
    isRangeBlockedWithCacheMock.mockReturnValue(false);
    fetchRangeBlockingCacheMock.mockResolvedValue({
      reservations: [],
      locks: [],
      closures: [],
    });
    getSpaceModelMock.mockResolvedValue({
      findById: (id: string) => ({
        exec: async () => spaceDoc(id),
      }),
    });
    service = new QuotesLocksService();
  });

  describe("checkAvailability", () => {
    it("returns available=true for free slots", async () => {
      const result = await service.checkAvailability(staffProfile(), {
        slots: [
          {
            spaceId: SPACE_A,
            startAt: "2026-08-01T10:00:00.000Z",
            endAt: "2026-08-01T11:00:00.000Z",
          },
        ],
      });
      expect(result.results[0]?.available).toBe(true);
      expect(result.results[0]?.reason).toBe("ok");
    });

    it("excludes own session locks when quoteDraftId provided", async () => {
      const sessionId = `staff-quote:${STAFF_ID}:${QUOTE_ID}`;
      fetchRangeBlockingCacheMock.mockResolvedValue({
        reservations: [],
        locks: [
          {
            sessionId,
            startAt: new Date("2026-08-01T10:00:00.000Z"),
            endAt: new Date("2026-08-01T11:00:00.000Z"),
          },
        ],
        closures: [],
      });

      await service.checkAvailability(staffProfile(), {
        quoteDraftId: QUOTE_ID,
        slots: [
          {
            spaceId: SPACE_A,
            startAt: "2026-08-01T10:00:00.000Z",
            endAt: "2026-08-01T11:00:00.000Z",
          },
        ],
      });

      expect(isRangeBlockedWithCacheMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ locks: [] }),
      );
    });
  });

  describe("acquire / refresh / release", () => {
    it("multi-acquires with staff-quote sessionId and 10 min TTL", async () => {
      const expiresAt = new Date("2026-08-01T10:10:00.000Z");
      acquireLocksForSessionMock.mockResolvedValue([
        {
          _id: "lock1",
          spaceId: SPACE_A,
          startAt: new Date("2026-08-01T10:00:00.000Z"),
          endAt: new Date("2026-08-01T11:00:00.000Z"),
          expiresAt,
        },
        {
          _id: "lock2",
          spaceId: SPACE_B,
          startAt: new Date("2026-08-01T10:00:00.000Z"),
          endAt: new Date("2026-08-01T11:00:00.000Z"),
          expiresAt,
        },
      ]);

      const result = await service.acquire(staffProfile(), {
        quoteDraftId: QUOTE_ID,
        slots: [
          {
            spaceId: SPACE_A,
            startAt: "2026-08-01T10:00:00.000Z",
            endAt: "2026-08-01T11:00:00.000Z",
          },
          {
            spaceId: SPACE_B,
            startAt: "2026-08-01T10:00:00.000Z",
            endAt: "2026-08-01T11:00:00.000Z",
          },
        ],
      });

      expect(releaseLocksBySessionIdMock).toHaveBeenCalledWith(
        `staff-quote:${STAFF_ID}:${QUOTE_ID}`,
      );
      expect(acquireLocksForSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: `staff-quote:${STAFF_ID}:${QUOTE_ID}`,
        }),
      );
      expect(result.locks).toHaveLength(2);
      expect(result.durationMs).toBe(600_000);
      expect(result.sessionId).toBe(`staff-quote:${STAFF_ID}:${QUOTE_ID}`);
    });

    it("maps SlotLockConflictError to 409 SLOT_LOCK_CONFLICT", async () => {
      acquireLocksForSessionMock.mockRejectedValue(new SlotLockConflictErrorMock());

      await expect(
        service.acquire(staffProfile(), {
          quoteDraftId: QUOTE_ID,
          slots: [
            {
              spaceId: SPACE_A,
              startAt: "2026-08-01T10:00:00.000Z",
              endAt: "2026-08-01T11:00:00.000Z",
            },
          ],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("refreshes active locks TTL", async () => {
      const expiresAt = new Date("2026-08-01T12:10:00.000Z");
      refreshLocksBySessionIdMock.mockResolvedValue({ refreshed: 1, expiresAt });
      findActiveLocksBySessionIdMock.mockResolvedValue([
        {
          _id: "lock1",
          spaceId: SPACE_A,
          startAt: new Date("2026-08-01T10:00:00.000Z"),
          endAt: new Date("2026-08-01T11:00:00.000Z"),
          expiresAt,
        },
      ]);

      const result = await service.refresh(staffProfile(), { quoteDraftId: QUOTE_ID });
      expect(result.refreshed).toBe(1);
      expect(result.expiresAt).toBe(expiresAt.toISOString());
      expect(result.locks).toHaveLength(1);
    });

    it("releases all session locks", async () => {
      releaseLocksBySessionIdMock.mockResolvedValue(2);
      const result = await service.release(staffProfile(), { quoteDraftId: QUOTE_ID });
      expect(result.released).toBe(2);
      expect(result.sessionId).toBe(`staff-quote:${STAFF_ID}:${QUOTE_ID}`);
    });

    it("404 when space missing on acquire", async () => {
      getSpaceModelMock.mockResolvedValue({
        findById: () => ({ exec: async () => null }),
      });

      await expect(
        service.acquire(staffProfile(), {
          quoteDraftId: QUOTE_ID,
          slots: [
            {
              spaceId: SPACE_A,
              startAt: "2026-08-01T10:00:00.000Z",
              endAt: "2026-08-01T11:00:00.000Z",
            },
          ],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
