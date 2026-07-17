import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Building, Space } from "@coworkprysme/db";
import {
  acquireLock,
  connectMongo,
  getBuildingModel,
  findActiveLockBySessionId,
  RangeOpeningHoursError,
  releaseLockById,
  SlotLockConflictError,
  SlotUnavailableError,
} from "@coworkprysme/db";
import {
  BOOKING_ERROR_CODES,
  ActiveBookingLockResponseSchema,
  BookingAvailabilityResponseSchema,
  BookingBuildingsResponseSchema,
  BookingLockResponseSchema,
  BookingSpaceAvailabilityResponseSchema,
  BookingSpacesResponseSchema,
  computeStartingPriceHTCents,
  DURATION_CLASS_LABELS,
  pickPrimaryPhotoStorageKey,
  type BookingAvailabilityQuery,
  type BookingSpaceAvailabilityQuery,
  type BookingSpaceCard,
  type BookingSpacesQuery,
  type CreateBookingLockRequest,
  type DiscountCodeTargetInput,
  type SpaceType,
} from "@coworkprysme/shared";
import type { Types } from "mongoose";

import { buildPublicImageUrl } from "../home-content/home-content.controller.js";
/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { AvailabilityService } from "./availability.service.js";
import { DiscountCodeValidationService } from "../discount-codes/discount-code-validation.service.js";
import { SlotGenerationService } from "./slot-generation.service.js";
import { isObjectId } from "./object-id.util.js";

type BuildingLean = Building & { _id: Types.ObjectId };
type SpaceLean = Space & { _id: Types.ObjectId };

function formatClosedDaysFr(closedDays: string[]): string {
  return closedDays
    .map((isoDate) => {
      const [yearText, monthText, dayText] = isoDate.split("-");
      const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText), 12));
      return date.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    })
    .join(", ");
}

@Injectable()
export class BookingService {
  constructor(
    private readonly availability: AvailabilityService,
    private readonly slotGeneration: SlotGenerationService,
    private readonly discountCodeValidation: DiscountCodeValidationService,
  ) {}

  private getApiOrigin(): string {
    const port = Number(process.env.PORT ?? 8002);
    return process.env.VITRINE_API_PUBLIC_ORIGIN?.replace(/\/$/, "") ?? `http://localhost:${port}`;
  }

  private buildPhotoUrl(storageKey: string | null, apiOrigin: string): string | null {
    if (!storageKey) {
      return null;
    }
    return buildPublicImageUrl(storageKey, "", apiOrigin);
  }

  private async getBuildingMap(buildingIds: Types.ObjectId[]): Promise<Map<string, BuildingLean>> {
    await connectMongo();
    const Building = await getBuildingModel();
    // Same rule as getCandidateSpaces: catalogue flag must not gate tunnel cards.
    const buildings = await Building.find({
      _id: { $in: buildingIds },
      status: "active",
    })
      .lean()
      .exec();

    return new Map(
      buildings.map((building) => [building._id.toString(), building as BuildingLean]),
    );
  }

  private mapSpaceCard(
    space: SpaceLean,
    building: BuildingLean,
    apiOrigin: string,
  ): BookingSpaceCard {
    const startingPriceHTCents = computeStartingPriceHTCents(space.tariffs);
    const startingDurationClass = space.tariffs.find(
      (tariff) => tariff.enabled !== false && tariff.priceHT === startingPriceHTCents,
    )?.durationClass;

    return {
      spaceId: space._id.toString(),
      slug: space.seo.slug,
      name: space.name,
      buildingId: building._id.toString(),
      buildingName: building.name,
      city: building.address.city,
      floor: space.floor ?? null,
      capacity: space.capacity,
      spaceType: space.type as SpaceType,
      equipments: space.equipments.slice(0, 5).map((equipment) => equipment.label),
      primaryPhotoUrl: this.buildPhotoUrl(pickPrimaryPhotoStorageKey(space.photos), apiOrigin),
      priceFromHTCents: startingPriceHTCents,
      priceFromLabel: startingDurationClass ? DURATION_CLASS_LABELS[startingDurationClass] : null,
    };
  }

  private async mapSpacesToCards(spaces: SpaceLean[]): Promise<BookingSpaceCard[]> {
    if (spaces.length === 0) {
      return [];
    }

    const apiOrigin = this.getApiOrigin();
    const buildingMap = await this.getBuildingMap([
      ...new Set(spaces.map((space) => space.buildingId)),
    ]);

    return spaces.flatMap((space) => {
      const building = buildingMap.get(space.buildingId.toString());
      if (!building) {
        return [];
      }
      return [this.mapSpaceCard(space, building, apiOrigin)];
    });
  }

  async searchAvailability(query: BookingAvailabilityQuery) {
    const startAt = new Date(query.startAt);
    const endAt = new Date(query.endAt);
    const candidates = await this.availability.getCandidateSpaces(query);
    const available = await this.availability.filterAvailableSpaces(candidates, startAt, endAt);

    return BookingAvailabilityResponseSchema.parse({
      spaces: await this.mapSpacesToCards(available),
    });
  }

  async listActiveBuildings() {
    await connectMongo();
    const Building = await getBuildingModel();
    const buildings = await Building.find({ status: "active" }).sort({ name: 1 }).lean().exec();

    return BookingBuildingsResponseSchema.parse({
      buildings: (buildings as BuildingLean[]).map((building) => ({
        id: building._id.toString(),
        name: building.name,
        city: building.address.city,
      })),
    });
  }

  async listSpaces(query: BookingSpacesQuery) {
    const spaces = await this.availability.getCandidateSpaces(query);
    return BookingSpacesResponseSchema.parse({
      spaces: await this.mapSpacesToCards(spaces),
    });
  }

  async getSpaceAvailability(spaceId: string, query: BookingSpaceAvailabilityQuery) {
    const space = await this.availability.getSpaceById(spaceId);
    if (!space) {
      throw new NotFoundException({
        code: BOOKING_ERROR_CODES.SPACE_NOT_FOUND,
        message: "Space not found",
      });
    }

    const rangeStart = new Date(query.rangeStart);
    const rangeEnd = new Date(query.rangeEnd);
    const slots = await this.slotGeneration.generateSlots(space, rangeStart, rangeEnd);

    return BookingSpaceAvailabilityResponseSchema.parse({
      spaceId: space._id.toString(),
      spaceName: space.name,
      slots,
    });
  }

  async createLock(input: CreateBookingLockRequest) {
    const space = await this.availability.getSpaceById(input.spaceId);
    if (!space) {
      throw new NotFoundException({
        code: BOOKING_ERROR_CODES.SPACE_NOT_FOUND,
        message: "Space not found",
      });
    }

    if (input.partySize !== undefined && input.partySize > space.capacity) {
      throw new ConflictException({
        code: BOOKING_ERROR_CODES.SLOT_UNAVAILABLE,
        message: "Capacity exceeded for this space",
      });
    }

    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);

    try {
      await this.availability.assertSpaceAvailable(space, startAt, endAt);
      const lock = await acquireLock({
        spaceId: space._id,
        startAt,
        endAt,
        sessionId: input.sessionId,
        partySize: input.partySize,
        durationClass: input.durationClass,
      });

      return BookingLockResponseSchema.parse({
        lockId: lock._id.toString(),
        expiresAt: lock.expiresAt.toISOString(),
        spaceId: space._id.toString(),
        startAt: lock.startAt.toISOString(),
        endAt: lock.endAt.toISOString(),
      });
    } catch (error) {
      if (error instanceof RangeOpeningHoursError) {
        throw new ConflictException({
          code: BOOKING_ERROR_CODES.VALIDATION_ERROR,
          message: `Accès impossible le(s) ${formatClosedDaysFr(error.closedDays)} : horaires ou fermeture exceptionnelle.`,
          closedDays: error.closedDays,
        });
      }
      if (error instanceof SlotUnavailableError) {
        throw new ConflictException({
          code: BOOKING_ERROR_CODES.SLOT_UNAVAILABLE,
          message: "This time slot is no longer available",
        });
      }
      if (error instanceof SlotLockConflictError) {
        throw new ConflictException({
          code: BOOKING_ERROR_CODES.SLOT_LOCK_CONFLICT,
          message: "This time slot is already being booked by someone else",
        });
      }
      throw error;
    }
  }

  async releaseLock(lockId: string, sessionId: string): Promise<void> {
    if (!isObjectId(lockId)) {
      throw new NotFoundException({
        code: BOOKING_ERROR_CODES.LOCK_NOT_FOUND,
        message: "Lock not found",
      });
    }

    const deleted = await releaseLockById(lockId, sessionId);
    if (!deleted) {
      throw new NotFoundException({
        code: BOOKING_ERROR_CODES.LOCK_NOT_FOUND,
        message: "Lock not found",
      });
    }
  }

  async getActiveLock(sessionId: string) {
    await connectMongo();
    const lockDoc = await findActiveLockBySessionId(sessionId);
    if (!lockDoc) {
      return ActiveBookingLockResponseSchema.parse({
        lock: null,
        space: null,
      });
    }

    const space = await this.availability.getSpaceById(lockDoc.spaceId.toString());
    if (!space) {
      return ActiveBookingLockResponseSchema.parse({
        lock: null,
        space: null,
      });
    }

    const buildingMap = await this.getBuildingMap([space.buildingId]);
    const building = buildingMap.get(space.buildingId.toString());
    if (!building) {
      return ActiveBookingLockResponseSchema.parse({
        lock: null,
        space: null,
      });
    }

    const apiOrigin = this.getApiOrigin();

    return ActiveBookingLockResponseSchema.parse({
      lock: {
        lockId: lockDoc._id.toString(),
        expiresAt: lockDoc.expiresAt.toISOString(),
        spaceId: lockDoc.spaceId.toString(),
        startAt: lockDoc.startAt.toISOString(),
        endAt: lockDoc.endAt.toISOString(),
      },
      space: this.mapSpaceCard(space, building, apiOrigin),
      partySize: lockDoc.partySize,
      durationClass: lockDoc.durationClass,
    });
  }

  /** Shared promo guard — Phase 2 POST /booking/price should call DiscountCodeValidationService.assertApplicable after lookup. */
  async validateDiscountCodeTargets(input: DiscountCodeTargetInput): Promise<void> {
    await this.discountCodeValidation.assertServiceTargets(input);
  }
}
