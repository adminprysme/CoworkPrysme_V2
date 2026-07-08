import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BuildingResponseSchema,
  BuildingsListResponseSchema,
  UpdateBuildingPhotosRequestSchema,
  isValidBuildingPhotoStorageKey,
  type CreateBuildingRequest,
  type UpdateBuildingPhotosRequest,
  type UpdateBuildingRequest,
} from "@coworkprysme/shared";
import { connectMongo, getBuildingModel, type StaffProfileDocument } from "@coworkprysme/db";
import type { BuildingPhoto } from "@coworkprysme/db";
import type { Types } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { GeocodingService } from "../geocoding/geocoding.service.js";
import { UploadsService } from "../uploads/uploads.service.js";
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

function normalizePhotoMetadata(photos: UpdateBuildingPhotosRequest["photos"]): BuildingPhoto[] {
  if (photos.length === 0) {
    return [];
  }

  const sorted = [...photos].sort((left, right) => left.order - right.order);
  const primaryIndex = sorted.findIndex((photo) => photo.isPrimary);

  return sorted.map((photo, index) => ({
    storageKey: photo.storageKey,
    alt: photo.alt?.trim() || undefined,
    order: index,
    isPrimary: primaryIndex === -1 ? index === 0 : index === primaryIndex,
  }));
}

@Injectable()
export class BuildingsService {
  constructor(
    private readonly geocoding: GeocodingService,
    private readonly uploads: UploadsService,
  ) {}

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
    const preservedPhotos = existing.photos.map((photo) => ({
      storageKey: photo.storageKey,
      alt: photo.alt,
      order: photo.order,
      isPrimary: photo.isPrimary,
    }));
    existing.set(payload);
    existing.photos = preservedPhotos;
    if (payload.description === undefined) {
      existing.set("description", undefined);
    }
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

    await this.uploads.deleteBuildingDirectory(id);
    await existing.deleteOne();
  }

  async uploadPhoto(id: string, buffer: Buffer, profile: StaffProfileDocument) {
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

    const limits = this.uploads.getLimits();
    if (existing.photos.length >= limits.UPLOAD_MAX_PHOTOS_PER_BUILDING) {
      throw new BadRequestException("Maximum photos reached");
    }

    const { storageKey } = await this.uploads.storeBuildingPhoto(id, buffer);
    const nextPhoto: BuildingPhoto = {
      storageKey,
      order: existing.photos.length,
      isPrimary: existing.photos.length === 0,
    };
    existing.photos.push(nextPhoto);
    await existing.save();

    const saved = await Building.findById(existing._id).lean().exec();
    if (!saved) {
      throw new NotFoundException();
    }

    return BuildingResponseSchema.parse(
      mapBuildingToResponse({ ...saved, _id: saved._id as Types.ObjectId }),
    );
  }

  async deletePhoto(id: string, storageKey: string, profile: StaffProfileDocument) {
    if (!isObjectId(id) || !isValidBuildingPhotoStorageKey(storageKey)) {
      throw new NotFoundException();
    }

    if (!storageKey.startsWith(`buildings/${id}/`)) {
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

    const photoIndex = existing.photos.findIndex((photo) => photo.storageKey === storageKey);
    if (photoIndex === -1) {
      throw new NotFoundException();
    }

    const wasPrimary = existing.photos[photoIndex]?.isPrimary ?? false;
    existing.photos.splice(photoIndex, 1);
    existing.photos = existing.photos
      .sort((left, right) => left.order - right.order)
      .map((photo, index) => ({
        ...photo,
        order: index,
        isPrimary: wasPrimary && index === 0 ? true : photo.isPrimary,
      }));

    if (
      wasPrimary &&
      existing.photos.length > 0 &&
      !existing.photos.some((photo) => photo.isPrimary)
    ) {
      existing.photos[0] = { ...existing.photos[0]!, isPrimary: true };
    }

    await this.uploads.deletePhotoFile(storageKey);
    await existing.save();

    const saved = await Building.findById(existing._id).lean().exec();
    if (!saved) {
      throw new NotFoundException();
    }

    return BuildingResponseSchema.parse(
      mapBuildingToResponse({ ...saved, _id: saved._id as Types.ObjectId }),
    );
  }

  async updatePhotos(id: string, input: unknown, profile: StaffProfileDocument) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    const parsed = UpdateBuildingPhotosRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException();
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

    const knownKeys = new Set(existing.photos.map((photo) => photo.storageKey));
    for (const photo of parsed.data.photos) {
      if (!isValidBuildingPhotoStorageKey(photo.storageKey) || !knownKeys.has(photo.storageKey)) {
        throw new BadRequestException("Unknown photo");
      }
      if (!photo.storageKey.startsWith(`buildings/${id}/`)) {
        throw new BadRequestException("Invalid photo");
      }
    }

    existing.photos = normalizePhotoMetadata(parsed.data.photos);
    await existing.save();

    const saved = await Building.findById(existing._id).lean().exec();
    if (!saved) {
      throw new NotFoundException();
    }

    return BuildingResponseSchema.parse(
      mapBuildingToResponse({ ...saved, _id: saved._id as Types.ObjectId }),
    );
  }
}
