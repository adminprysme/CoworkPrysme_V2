import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  acquireLocksForSession,
  assertRangeAvailable,
  buildStaffQuoteLockSessionId,
  connectMongo,
  fetchRangeBlockingCache,
  getSpaceModel,
  isRangeBlockedWithCache,
  RangeOpeningHoursError,
  refreshLocksBySessionId,
  releaseLocksBySessionId,
  findActiveLocksBySessionId,
  SLOT_LOCK_DURATION_MS,
  SlotLockConflictError,
  SlotUnavailableError,
  type SpaceDocument,
  type StaffProfileDocument,
  validateRangeAccessibility,
} from "@coworkprysme/db";
import {
  BILLING_QUOTE_LOCKS_ERROR_CODES,
  StaffQuoteAvailabilityCheckResponseSchema,
  StaffQuoteLocksAcquireResponseSchema,
  StaffQuoteLocksRefreshResponseSchema,
  StaffQuoteLocksReleaseResponseSchema,
  type StaffQuoteAvailabilityCheckRequest,
  type StaffQuoteAvailabilityCheckResponse,
  type StaffQuoteLockSlot,
  type StaffQuoteLocksAcquireRequest,
  type StaffQuoteLocksAcquireResponse,
  type StaffQuoteLocksRefreshResponse,
  type StaffQuoteLocksReleaseResponse,
  type StaffQuoteLocksSessionRequest,
} from "@coworkprysme/shared";

@Injectable()
export class QuotesLocksService {
  sessionIdFor(profile: StaffProfileDocument, quoteDraftId: string): string {
    return buildStaffQuoteLockSessionId(String(profile._id), quoteDraftId);
  }

  async checkAvailability(
    profile: StaffProfileDocument,
    input: StaffQuoteAvailabilityCheckRequest,
  ): Promise<StaffQuoteAvailabilityCheckResponse> {
    await connectMongo();
    const excludeSessionId = input.quoteDraftId
      ? this.sessionIdFor(profile, input.quoteDraftId)
      : undefined;

    const results = [];
    for (const slot of input.slots) {
      results.push(await this.checkOneSlot(slot, excludeSessionId));
    }
    return StaffQuoteAvailabilityCheckResponseSchema.parse({ results });
  }

  async acquire(
    profile: StaffProfileDocument,
    input: StaffQuoteLocksAcquireRequest,
  ): Promise<StaffQuoteLocksAcquireResponse> {
    await connectMongo();
    const sessionId = this.sessionIdFor(profile, input.quoteDraftId);
    const now = new Date();

    // Drop prior wizard locks so availability assert does not self-block, then re-acquire.
    await releaseLocksBySessionId(sessionId);

    const spaces: SpaceDocument[] = [];
    for (const slot of input.slots) {
      spaces.push(await this.loadSpaceForAcquire(slot));
    }

    try {
      const locks = await acquireLocksForSession({
        sessionId,
        slots: input.slots.map((slot, index) => ({
          spaceId: spaces[index]!._id,
          startAt: new Date(slot.startAt),
          endAt: new Date(slot.endAt),
          partySize: slot.partySize,
        })),
        now,
      });

      const expiresAt = locks[0]?.expiresAt ?? new Date(now.getTime() + SLOT_LOCK_DURATION_MS);
      return StaffQuoteLocksAcquireResponseSchema.parse({
        sessionId,
        locks: locks.map((lock) => ({
          lockId: String(lock._id),
          spaceId: String(lock.spaceId),
          startAt: lock.startAt.toISOString(),
          endAt: lock.endAt.toISOString(),
          expiresAt: lock.expiresAt.toISOString(),
        })),
        expiresAt: expiresAt.toISOString(),
        durationMs: SLOT_LOCK_DURATION_MS,
      });
    } catch (error) {
      this.rethrowLockError(error);
    }
  }

  async refresh(
    profile: StaffProfileDocument,
    input: StaffQuoteLocksSessionRequest,
  ): Promise<StaffQuoteLocksRefreshResponse> {
    await connectMongo();
    const sessionId = this.sessionIdFor(profile, input.quoteDraftId);
    const now = new Date();
    const { refreshed, expiresAt } = await refreshLocksBySessionId(sessionId, now);
    const locks = await findActiveLocksBySessionId(sessionId, now);
    return StaffQuoteLocksRefreshResponseSchema.parse({
      sessionId,
      refreshed,
      expiresAt: refreshed > 0 ? expiresAt.toISOString() : null,
      locks: locks.map((lock) => ({
        lockId: String(lock._id),
        spaceId: String(lock.spaceId),
        startAt: lock.startAt.toISOString(),
        endAt: lock.endAt.toISOString(),
        expiresAt: lock.expiresAt.toISOString(),
      })),
      durationMs: SLOT_LOCK_DURATION_MS,
    });
  }

  async release(
    profile: StaffProfileDocument,
    input: StaffQuoteLocksSessionRequest,
  ): Promise<StaffQuoteLocksReleaseResponse> {
    await connectMongo();
    const sessionId = this.sessionIdFor(profile, input.quoteDraftId);
    const released = await releaseLocksBySessionId(sessionId);
    return StaffQuoteLocksReleaseResponseSchema.parse({ sessionId, released });
  }

  private async checkOneSlot(
    slot: StaffQuoteLockSlot,
    excludeSessionId?: string,
  ): Promise<{
    spaceId: string;
    startAt: string;
    endAt: string;
    available: boolean;
    reason?: "ok" | "unavailable" | "opening_hours" | "capacity" | "not_found";
  }> {
    const Space = await getSpaceModel();
    const space = await Space.findById(slot.spaceId).exec();
    if (!space) {
      return {
        spaceId: slot.spaceId,
        startAt: slot.startAt,
        endAt: slot.endAt,
        available: false,
        reason: "not_found",
      };
    }
    if (slot.partySize !== undefined && slot.partySize > space.capacity) {
      return {
        spaceId: slot.spaceId,
        startAt: slot.startAt,
        endAt: slot.endAt,
        available: false,
        reason: "capacity",
      };
    }

    const startAt = new Date(slot.startAt);
    const endAt = new Date(slot.endAt);
    const context = {
      spaceId: space._id,
      buildingId: space.buildingId,
      spaceType: space.type,
      openingHours: space.openingHours,
      startAt,
      endAt,
    };

    const cache = await fetchRangeBlockingCache(context);
    if (excludeSessionId) {
      cache.locks = cache.locks.filter((lock) => lock.sessionId !== excludeSessionId);
    }

    const accessibility = validateRangeAccessibility(context, cache.closures);
    if (!accessibility.valid) {
      return {
        spaceId: slot.spaceId,
        startAt: slot.startAt,
        endAt: slot.endAt,
        available: false,
        reason: "opening_hours",
      };
    }

    if (isRangeBlockedWithCache(context, cache)) {
      return {
        spaceId: slot.spaceId,
        startAt: slot.startAt,
        endAt: slot.endAt,
        available: false,
        reason: "unavailable",
      };
    }

    return {
      spaceId: slot.spaceId,
      startAt: slot.startAt,
      endAt: slot.endAt,
      available: true,
      reason: "ok",
    };
  }

  private async loadSpaceForAcquire(slot: StaffQuoteLockSlot): Promise<SpaceDocument> {
    const Space = await getSpaceModel();
    const space = await Space.findById(slot.spaceId).exec();
    if (!space) {
      throw new NotFoundException({
        code: BILLING_QUOTE_LOCKS_ERROR_CODES.SPACE_NOT_FOUND,
        message: "Espace introuvable",
      });
    }
    if (slot.partySize !== undefined && slot.partySize > space.capacity) {
      throw new ConflictException({
        code: BILLING_QUOTE_LOCKS_ERROR_CODES.CAPACITY_EXCEEDED,
        message: "Capacité de l'espace dépassée",
      });
    }

    try {
      await assertRangeAvailable({
        spaceId: space._id,
        buildingId: space.buildingId,
        spaceType: space.type,
        openingHours: space.openingHours,
        startAt: new Date(slot.startAt),
        endAt: new Date(slot.endAt),
      });
    } catch (error) {
      this.rethrowLockError(error);
    }
    return space;
  }

  private rethrowLockError(error: unknown): never {
    if (error instanceof RangeOpeningHoursError) {
      throw new ConflictException({
        code: BILLING_QUOTE_LOCKS_ERROR_CODES.SLOT_UNAVAILABLE,
        message: `Horaires ou fermeture : ${error.closedDays.join(", ")}`,
        closedDays: error.closedDays,
      });
    }
    if (error instanceof SlotUnavailableError) {
      throw new ConflictException({
        code: BILLING_QUOTE_LOCKS_ERROR_CODES.SLOT_UNAVAILABLE,
        message: "Ce créneau n'est plus disponible",
      });
    }
    if (error instanceof SlotLockConflictError) {
      throw new ConflictException({
        code: BILLING_QUOTE_LOCKS_ERROR_CODES.SLOT_LOCK_CONFLICT,
        message: "Ce créneau est déjà verrouillé par une autre session",
      });
    }
    if (error instanceof BadRequestException || error instanceof ConflictException) {
      throw error;
    }
    throw error;
  }
}
