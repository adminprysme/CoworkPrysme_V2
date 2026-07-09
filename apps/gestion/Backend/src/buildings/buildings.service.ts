import {
  BadRequestException,
  ConflictException,
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
import {
  connectMongo,
  getBuildingModel,
  getSpaceModel,
  type StaffProfileDocument,
} from "@coworkprysme/db";
import type { BuildingPhoto } from "@coworkprysme/db";
import type { Types } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { GeocodingService } from "../geocoding/geocoding.service.js";
import {
  buildBuildingDeleteBlockedMessage,
  collectRemovedStorageKeys,
} from "../uploads/photo-storage.helpers.js";
import { UploadsService } from "../uploads/uploads.service.js";
import {
  buildScopeFilter,
  canCreateBuilding,
  isBuildingInScope,
  mapBuildingToResponse,
  mapRequestToDbDocument,
} from "./buildings.mapper.js";
import { resolveVitrineBuildingFlags } from "./buildings-vitrine.js";

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

async function clearOtherDefaultBuildings(
  Building: Awaited<ReturnType<typeof getBuildingModel>>,
  keepBuildingId: Types.ObjectId,
): Promise<void> {
  await Building.updateMany(
    { _id: { $ne: keepBuildingId }, isDefaultVitrineBuilding: true },
    { $set: { isDefaultVitrineBuilding: false } },
  ).exec();
}

function mapBuildingRequestToDbDocument(
  input: CreateBuildingRequest | UpdateBuildingRequest,
  coordinates: { lat: number; lng: number },
) {
  const vitrineFlags = resolveVitrineBuildingFlags({
    status: input.status,
    visibleOnVitrine: input.visibleOnVitrine,
    isDefaultVitrineBuilding: input.isDefaultVitrineBuilding,
  });

  return mapRequestToDbDocument({ ...input, ...vitrineFlags }, coordinates);
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

  async create(input: CreateBuildingRequest, profile: StaffProfileDocument) {
    if (!canCreateBuilding(profile)) {
      throw new ForbiddenException();
    }

    const coordinates = await this.geocoding.geocodeAddress(input.address);
    const payload = mapBuildingRequestToDbDocument(input, coordinates);

    await connectMongo();
    const Building = await getBuildingModel();
    const doc = await Building.create(payload);
    if (payload.isDefaultVitrineBuilding) {
      await clearOtherDefaultBuildings(Building, doc._id as Types.ObjectId);
    }
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
    const payload = mapBuildingRequestToDbDocument(input, coordinates);
    const preservedPhotos = existing.photos.map((photo) => ({
      storageKey: photo.storageKey,
      alt: photo.alt,
      order: photo.order,
      isPrimary: photo.isPrimary,
    }));
    if (payload.isDefaultVitrineBuilding) {
      await clearOtherDefaultBuildings(Building, existing._id as Types.ObjectId);
    }
    existing.set(payload);
    existing.photos = preservedPhotos;
    if (payload.description === undefined) {
      existing.set("description", undefined);
    }
    if (payload.phone === undefined) {
      existing.set("phone", undefined);
    }
    if (payload.email === undefined) {
      existing.set("email", undefined);
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

    const Space = await getSpaceModel();
    const spaceCount = await Space.countDocuments({ buildingId: existing._id }).exec();
    if (spaceCount > 0) {
      throw new ConflictException(buildBuildingDeleteBlockedMessage(spaceCount));
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

    try {
      existing.photos.push(nextPhoto);
      await existing.save();
    } catch (error) {
      await this.uploads.deletePhotoFile(storageKey);
      throw error;
    }

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

    const removedKeys = collectRemovedStorageKeys(existing.photos, parsed.data.photos);
    existing.photos = normalizePhotoMetadata(parsed.data.photos);
    await existing.save();

    for (const storageKey of removedKeys) {
      await this.uploads.deletePhotoFile(storageKey);
    }

    const saved = await Building.findById(existing._id).lean().exec();
    if (!saved) {
      throw new NotFoundException();
    }

    return BuildingResponseSchema.parse(
      mapBuildingToResponse({ ...saved, _id: saved._id as Types.ObjectId }),
    );
  }
}
