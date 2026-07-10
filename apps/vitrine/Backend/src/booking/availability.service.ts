import { Injectable } from "@nestjs/common";
import type { Space } from "@coworkprysme/db";
import {
  assertRangeAvailable,
  connectMongo,
  fetchRangeBlockingCache,
  getBuildingModel,
  getSpaceModel,
  isRangeBlocked,
  isRangeBlockedWithCache,
  type RangeAvailabilityContext,
  type RangeBlockingCache,
} from "@coworkprysme/db";
import type { SpaceType } from "@coworkprysme/shared";
import type { Types } from "mongoose";

import { isObjectId, toObjectId } from "./object-id.util.js";

type SpaceLean = Space & { _id: Types.ObjectId };

export interface SpaceSearchFilters {
  spaceType: SpaceType;
  partySize: number;
  buildingId?: string;
  floor?: string;
}

@Injectable()
export class AvailabilityService {
  async getCandidateSpaces(filters: SpaceSearchFilters): Promise<SpaceLean[]> {
    await connectMongo();
    const Building = await getBuildingModel();
    const buildingQuery: Record<string, unknown> = {
      visibleOnVitrine: true,
      status: "active",
    };
    if (filters.buildingId) {
      buildingQuery._id = toObjectId(filters.buildingId);
    }

    const buildings = await Building.find(buildingQuery).lean().exec();
    if (buildings.length === 0) {
      return [];
    }

    const buildingIds = buildings.map((building) => building._id);
    const Space = await getSpaceModel();
    const spaceQuery: Record<string, unknown> = {
      buildingId: { $in: buildingIds },
      status: "active",
      type: filters.spaceType,
      capacity: { $gte: filters.partySize },
    };
    if (filters.floor) {
      spaceQuery.floor = filters.floor;
    }

    const spaces = await Space.find(spaceQuery)
      .sort({ featuredOnVitrine: -1, vitrineOrder: 1, name: 1 })
      .lean()
      .exec();

    return spaces as SpaceLean[];
  }

  buildContext(
    space: SpaceLean,
    startAt: Date,
    endAt: Date,
    now: Date = new Date(),
  ): RangeAvailabilityContext {
    return {
      spaceId: space._id,
      buildingId: space.buildingId,
      spaceType: space.type,
      openingHours: space.openingHours,
      startAt,
      endAt,
      now,
    };
  }

  async isSpaceAvailable(
    space: SpaceLean,
    startAt: Date,
    endAt: Date,
    now?: Date,
  ): Promise<boolean> {
    return !(await isRangeBlocked(this.buildContext(space, startAt, endAt, now)));
  }

  async loadBlockingCache(
    space: SpaceLean,
    rangeStart: Date,
    rangeEnd: Date,
    now: Date = new Date(),
  ): Promise<RangeBlockingCache> {
    return fetchRangeBlockingCache({
      spaceId: space._id,
      buildingId: space.buildingId,
      spaceType: space.type,
      startAt: rangeStart,
      endAt: rangeEnd,
      now,
    });
  }

  isSpaceAvailableWithCache(
    space: SpaceLean,
    startAt: Date,
    endAt: Date,
    cache: RangeBlockingCache,
    now?: Date,
  ): boolean {
    return !isRangeBlockedWithCache(this.buildContext(space, startAt, endAt, now), cache);
  }

  async assertSpaceAvailable(
    space: SpaceLean,
    startAt: Date,
    endAt: Date,
    now?: Date,
  ): Promise<void> {
    await assertRangeAvailable(this.buildContext(space, startAt, endAt, now));
  }

  async filterAvailableSpaces(
    spaces: SpaceLean[],
    startAt: Date,
    endAt: Date,
    now: Date = new Date(),
  ): Promise<SpaceLean[]> {
    const available: SpaceLean[] = [];
    for (const space of spaces) {
      if (await this.isSpaceAvailable(space, startAt, endAt, now)) {
        available.push(space);
      }
    }
    return available;
  }

  async getSpaceById(spaceId: string): Promise<SpaceLean | null> {
    await connectMongo();
    const Space = await getSpaceModel();
    if (!isObjectId(spaceId)) {
      return null;
    }

    const space = await Space.findOne({
      _id: toObjectId(spaceId),
      status: "active",
    })
      .lean()
      .exec();

    return (space as SpaceLean | null) ?? null;
  }
}
