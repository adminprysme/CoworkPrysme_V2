import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CreateSpaceRequestSchema,
  SpaceResponseSchema,
  SpacesListResponseSchema,
  UpdateEntityPhotosRequestSchema,
  UpdateSpaceRequestSchema,
  isValidSpacePhotoStorageKey,
  type CreateSpaceRequest,
  type UpdateEntityPhotosRequest,
  type UpdateSpaceRequest,
} from "@coworkprysme/shared";
import {
  connectMongo,
  getBuildingModel,
  getSpaceModel,
  type BuildingPhoto,
  type StaffProfileDocument,
} from "@coworkprysme/db";
import type { Types } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { UploadsService } from "../uploads/uploads.service.js";
import {
  baseSlugForSpaceName,
  buildSeoForSpace,
  buildSpaceScopeFilter,
  isBuildingInScope,
  mapRequestToDbDocument,
  mapSpaceToResponse,
  resolveUniqueSlug,
} from "./spaces.mapper.js";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

function isObjectId(value: string): boolean {
  return OBJECT_ID_PATTERN.test(value);
}

function normalizePhotoMetadata(photos: UpdateEntityPhotosRequest["photos"]): BuildingPhoto[] {
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
export class SpacesService {
  constructor(private readonly uploads: UploadsService) {}

  private async resolveUniqueSpaceSeo(name: string, description?: string, excludeSpaceId?: string) {
    await connectMongo();
    const Space = await getSpaceModel();
    const baseSlug = baseSlugForSpaceName(name);
    const takenSlugs = new Set<string>();

    const existing = await Space.find(excludeSpaceId ? { _id: { $ne: excludeSpaceId } } : {}, {
      "seo.slug": 1,
    })
      .lean()
      .exec();

    for (const doc of existing) {
      takenSlugs.add(doc.seo.slug);
    }

    const seoMeta = buildSeoForSpace(name, description);
    return {
      ...seoMeta,
      slug: resolveUniqueSlug(baseSlug, takenSlugs),
    };
  }

  async listByBuilding(buildingId: string, profile: StaffProfileDocument) {
    if (!isObjectId(buildingId)) {
      throw new NotFoundException();
    }

    await connectMongo();
    const Building = await getBuildingModel();
    const building = await Building.findById(buildingId).lean().exec();
    if (!building) {
      throw new NotFoundException();
    }

    if (!isBuildingInScope(building._id as Types.ObjectId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    const Space = await getSpaceModel();
    const scopeFilter = buildSpaceScopeFilter(profile.scope.buildingIds);
    const docs = await Space.find({ buildingId, ...scopeFilter })
      .sort({ name: 1 })
      .lean()
      .exec();

    return SpacesListResponseSchema.parse({
      spaces: docs.map((doc) => mapSpaceToResponse({ ...doc, _id: doc._id as Types.ObjectId })),
    });
  }

  async getById(id: string, profile: StaffProfileDocument) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    await connectMongo();
    const Space = await getSpaceModel();
    const doc = await Space.findById(id).lean().exec();
    if (!doc) {
      throw new NotFoundException();
    }

    if (!isBuildingInScope(doc.buildingId as Types.ObjectId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    return SpaceResponseSchema.parse(
      mapSpaceToResponse({ ...doc, _id: doc._id as Types.ObjectId }),
    );
  }

  async create(buildingId: string, input: CreateSpaceRequest, profile: StaffProfileDocument) {
    if (!isObjectId(buildingId)) {
      throw new NotFoundException();
    }

    const parsed = CreateSpaceRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException();
    }

    await connectMongo();
    const Building = await getBuildingModel();
    const building = await Building.findById(buildingId).lean().exec();
    if (!building) {
      throw new NotFoundException();
    }

    if (!isBuildingInScope(building._id as Types.ObjectId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    const seo = await this.resolveUniqueSpaceSeo(parsed.data.name, parsed.data.description);
    const payload = mapRequestToDbDocument(parsed.data, building._id as Types.ObjectId, seo);

    const Space = await getSpaceModel();
    const doc = await Space.create({ ...payload, photos: [] });
    const saved = await Space.findById(doc._id).lean().exec();
    if (!saved) {
      throw new NotFoundException();
    }

    return SpaceResponseSchema.parse(
      mapSpaceToResponse({ ...saved, _id: saved._id as Types.ObjectId }),
    );
  }

  async update(id: string, input: UpdateSpaceRequest, profile: StaffProfileDocument) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    const parsed = UpdateSpaceRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException();
    }

    await connectMongo();
    const Space = await getSpaceModel();
    const existing = await Space.findById(id).exec();
    if (!existing) {
      throw new NotFoundException();
    }

    if (!isBuildingInScope(existing.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    const seo = await this.resolveUniqueSpaceSeo(
      parsed.data.name,
      parsed.data.description,
      existing._id.toString(),
    );
    const payload = mapRequestToDbDocument(parsed.data, existing.buildingId, seo);

    existing.set(payload);
    if (payload.description === undefined) {
      existing.set("description", undefined);
    }
    if (payload.accessCode === undefined) {
      existing.set("accessCode", undefined);
    }
    await existing.save();

    const saved = await Space.findById(existing._id).lean().exec();
    if (!saved) {
      throw new NotFoundException();
    }

    return SpaceResponseSchema.parse(
      mapSpaceToResponse({ ...saved, _id: saved._id as Types.ObjectId }),
    );
  }

  async delete(id: string, profile: StaffProfileDocument) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    await connectMongo();
    const Space = await getSpaceModel();
    const existing = await Space.findById(id).exec();
    if (!existing) {
      throw new NotFoundException();
    }

    if (!isBuildingInScope(existing.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    await this.uploads.deleteSpaceDirectory(id);
    await existing.deleteOne();
  }

  async uploadPhoto(id: string, buffer: Buffer, profile: StaffProfileDocument) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    await connectMongo();
    const Space = await getSpaceModel();
    const existing = await Space.findById(id).exec();
    if (!existing) {
      throw new NotFoundException();
    }

    if (!isBuildingInScope(existing.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    const limits = this.uploads.getLimits();
    if (existing.photos.length >= limits.UPLOAD_MAX_PHOTOS_PER_SPACE) {
      throw new BadRequestException("Maximum photos reached");
    }

    const { storageKey } = await this.uploads.storeSpacePhoto(id, buffer);
    const nextPhoto: BuildingPhoto = {
      storageKey,
      order: existing.photos.length,
      isPrimary: existing.photos.length === 0,
    };
    existing.photos.push(nextPhoto);
    await existing.save();

    const saved = await Space.findById(existing._id).lean().exec();
    if (!saved) {
      throw new NotFoundException();
    }

    return SpaceResponseSchema.parse(
      mapSpaceToResponse({ ...saved, _id: saved._id as Types.ObjectId }),
    );
  }

  async deletePhoto(id: string, storageKey: string, profile: StaffProfileDocument) {
    if (!isObjectId(id) || !isValidSpacePhotoStorageKey(storageKey)) {
      throw new NotFoundException();
    }

    if (!storageKey.startsWith(`spaces/${id}/`)) {
      throw new NotFoundException();
    }

    await connectMongo();
    const Space = await getSpaceModel();
    const existing = await Space.findById(id).exec();
    if (!existing) {
      throw new NotFoundException();
    }

    if (!isBuildingInScope(existing.buildingId, profile.scope.buildingIds)) {
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

    const saved = await Space.findById(existing._id).lean().exec();
    if (!saved) {
      throw new NotFoundException();
    }

    return SpaceResponseSchema.parse(
      mapSpaceToResponse({ ...saved, _id: saved._id as Types.ObjectId }),
    );
  }

  async updatePhotos(id: string, input: unknown, profile: StaffProfileDocument) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    const parsed = UpdateEntityPhotosRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException();
    }

    await connectMongo();
    const Space = await getSpaceModel();
    const existing = await Space.findById(id).exec();
    if (!existing) {
      throw new NotFoundException();
    }

    if (!isBuildingInScope(existing.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    const knownKeys = new Set(existing.photos.map((photo) => photo.storageKey));
    for (const photo of parsed.data.photos) {
      if (!isValidSpacePhotoStorageKey(photo.storageKey) || !knownKeys.has(photo.storageKey)) {
        throw new BadRequestException("Unknown photo");
      }
      if (!photo.storageKey.startsWith(`spaces/${id}/`)) {
        throw new BadRequestException("Invalid photo");
      }
    }

    existing.photos = normalizePhotoMetadata(parsed.data.photos);
    await existing.save();

    const saved = await Space.findById(existing._id).lean().exec();
    if (!saved) {
      throw new NotFoundException();
    }

    return SpaceResponseSchema.parse(
      mapSpaceToResponse({ ...saved, _id: saved._id as Types.ObjectId }),
    );
  }
}
