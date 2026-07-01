import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  BuildingsListResponseSchema,
  BuildingResponseSchema,
  type CreateBuildingRequest,
  type UpdateBuildingRequest,
} from "@coworkprysme/shared";
import { connectMongo, getBuildingModel, type StaffProfileDocument } from "@coworkprysme/db";
import type { Types } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { GeocodingService } from "../geocoding/geocoding.service.js";
import {
  buildScopeFilter,
  isBuildingInScope,
  mapBuildingToResponse,
  mapRequestToDbDocument,
} from "./buildings.mapper.js";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

function isObjectId(value: string): boolean {
  return OBJECT_ID_PATTERN.test(value);
}

@Injectable()
export class BuildingsService {
  constructor(private readonly geocoding: GeocodingService) {}

  async list(profile: StaffProfileDocument) {
    await connectMongo();
    const Building = await getBuildingModel();
    const scopeFilter = buildScopeFilter(profile.scope.buildingIds);
    const docs = await Building.find(scopeFilter).sort({ name: 1 }).lean().exec();

    return BuildingsListResponseSchema.parse({
      buildings: docs.map((doc) =>
        mapBuildingToResponse({ ...doc, _id: doc._id as Types.ObjectId }),
      ),
    });
  }

  async getById(id: string, profile: StaffProfileDocument) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    await connectMongo();
    const Building = await getBuildingModel();
    const doc = await Building.findById(id).lean().exec();
    if (!doc) {
      throw new NotFoundException();
    }

    const buildingId = doc._id as Types.ObjectId;
    if (!isBuildingInScope(buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    return BuildingResponseSchema.parse(mapBuildingToResponse({ ...doc, _id: buildingId }));
  }

  async create(input: CreateBuildingRequest, _profile: StaffProfileDocument) {
    const coordinates = await this.geocoding.geocodeAddress(input.address);
    const payload = mapRequestToDbDocument(input, coordinates);

    await connectMongo();
    const Building = await getBuildingModel();
    const doc = await Building.create(payload);
    const saved = await Building.findById(doc._id).lean().exec();
    if (!saved) {
      throw new NotFoundException();
    }

    return BuildingResponseSchema.parse(
      mapBuildingToResponse({ ...saved, _id: saved._id as Types.ObjectId }),
    );
  }

  async update(id: string, input: UpdateBuildingRequest, profile: StaffProfileDocument) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    await connectMongo();
    const Building = await getBuildingModel();
    const existing = await Building.findById(id).exec();
    if (!existing) {
      throw new NotFoundException();
    }

    if (!isBuildingInScope(existing._id, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    const coordinates = await this.geocoding.geocodeAddress(input.address);
    const payload = mapRequestToDbDocument(input, coordinates);
    existing.set(payload);
    await existing.save();

    const saved = await Building.findById(existing._id).lean().exec();
    if (!saved) {
      throw new NotFoundException();
    }

    return BuildingResponseSchema.parse(
      mapBuildingToResponse({ ...saved, _id: saved._id as Types.ObjectId }),
    );
  }

  async delete(id: string, profile: StaffProfileDocument) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    await connectMongo();
    const Building = await getBuildingModel();
    const existing = await Building.findById(id).exec();
    if (!existing) {
      throw new NotFoundException();
    }

    if (!isBuildingInScope(existing._id, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    await existing.deleteOne();
  }
}
