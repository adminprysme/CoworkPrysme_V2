import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CreateSpaceRequestSchema,
  SpaceArchiveResponseSchema,
  SpaceResponseSchema,
  SpaceRestoreRequestSchema,
  SpacesListResponseSchema,
  UpdateEntityPhotosRequestSchema,
  UpdateSpaceRequestSchema,
  isValidSpacePhotoStorageKey,
  type CreateSpaceRequest,
  type SpaceRestoreRequest,
  type UpdateEntityPhotosRequest,
  type UpdateSpaceRequest,
} from "@coworkprysme/shared";
import {
  BLOCKING_RESERVATION_STATUSES,
  connectMongo,
  getBuildingModel,
  getReservationModel,
  getSpaceModel,
  type BuildingPhoto,
  type Space,
  type StaffProfileDocument,
} from "@coworkprysme/db";
import type { Types } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { collectRemovedStorageKeys } from "../uploads/photo-storage.helpers.js";
import { UploadsService } from "../uploads/uploads.service.js";
import {
  baseSlugForSpaceName,
  buildArchivedSpaceSlug,
  buildSeoForSpace,
  buildSpaceScopeFilter,
  isBuildingInScope,
  mapRequestToDbDocument,
  mapSpaceToResponse,
  resolveUniqueSlug,
} from "./spaces.mapper.js";
import { resolveSpaceVitrineFlags } from "./spaces-vitrine.js";

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

function mapSpaceRequestToDbDocument(
  input: CreateSpaceRequest,
  buildingId: Types.ObjectId,
  seo: Space["seo"],
) {
  const vitrineFlags = resolveSpaceVitrineFlags({
    status: input.status,
    featuredOnVitrine: input.featuredOnVitrine,
    vitrineOrder: input.vitrineOrder,
  });

  return mapRequestToDbDocument({ ...input, ...vitrineFlags }, buildingId, seo);
}

function assertSpaceMutable(status: string): void {
  if (status === "archived") {
    throw new ConflictException("Cet espace est archivé. Restaurez-le avant toute modification.");
  }
}

function buildListStatusFilter(options: { includeArchived?: boolean; archivedOnly?: boolean }) {
  if (options.archivedOnly) {
    return { status: "archived" as const };
  }
  if (options.includeArchived) {
    return {};
  }
  return { status: { $ne: "archived" as const } };
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

  async listByBuilding(
    buildingId: string,
    profile: StaffProfileDocument,
    options: { includeArchived?: boolean; archivedOnly?: boolean } = {},
  ) {
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
    const statusFilter = buildListStatusFilter(options);
    const docs = await Space.find({ buildingId, ...scopeFilter, ...statusFilter })
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
    const payload = mapSpaceRequestToDbDocument(parsed.data, building._id as Types.ObjectId, seo);

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

    assertSpaceMutable(existing.status);

    const seo = await this.resolveUniqueSpaceSeo(
      parsed.data.name,
      parsed.data.description,
      existing._id.toString(),
    );
    const payload = mapSpaceRequestToDbDocument(parsed.data, existing.buildingId, seo);

    existing.set(payload);
    if (payload.description === undefined) {
      existing.set("description", undefined);
    }
    if (payload.accessCode === undefined) {
      existing.set("accessCode", undefined);
    }
    if (payload.vitrineOrder === undefined) {
      existing.set("vitrineOrder", undefined);
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

  async archive(id: string, profile: StaffProfileDocument) {
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

    if (existing.status === "archived") {
      throw new ConflictException("Cet espace est déjà archivé.");
    }

    const Reservation = await getReservationModel();
    const blockingReservations = await Reservation.countDocuments({
      spaceId: existing._id,
      status: { $in: BLOCKING_RESERVATION_STATUSES },
    }).exec();

    if (blockingReservations > 0) {
      throw new ConflictException(
        "Impossible d'archiver cet espace : des réservations en cours y sont rattachées.",
      );
    }

    existing.status = "archived";
    existing.archivedAt = new Date();
    existing.archivedBy = profile._id;
    existing.seo = {
      ...existing.seo,
      slug: buildArchivedSpaceSlug(existing.seo.slug, existing._id.toString()),
    };
    await existing.save();

    const saved = await Space.findById(existing._id).lean().exec();
    if (!saved) {
      throw new NotFoundException();
    }

    return SpaceArchiveResponseSchema.parse({
      ok: true,
      space: mapSpaceToResponse({ ...saved, _id: saved._id as Types.ObjectId }),
    });
  }

  async restore(id: string, input: SpaceRestoreRequest, profile: StaffProfileDocument) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    const parsed = SpaceRestoreRequestSchema.safeParse(input);
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

    if (existing.status !== "archived") {
      throw new ConflictException("Seuls les espaces archivés peuvent être restaurés.");
    }

    const seo = await this.resolveUniqueSpaceSeo(
      existing.name,
      existing.description,
      existing._id.toString(),
    );

    existing.status = parsed.data.status;
    existing.archivedAt = undefined;
    existing.archivedBy = undefined;
    existing.seo = seo;
    await existing.save();

    const saved = await Space.findById(existing._id).lean().exec();
    if (!saved) {
      throw new NotFoundException();
    }

    return SpaceResponseSchema.parse(
      mapSpaceToResponse({ ...saved, _id: saved._id as Types.ObjectId }),
    );
  }

  /** @deprecated Use archive — kept as alias for the HTTP DELETE route. */
  async delete(id: string, profile: StaffProfileDocument) {
    return this.archive(id, profile);
  }

  async purgePermanently(id: string, profile: StaffProfileDocument) {
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

    if (existing.status !== "archived") {
      throw new ConflictException(
        "Seuls les espaces archivés peuvent être supprimés définitivement.",
      );
    }

    const Reservation = await getReservationModel();
    const reservationCount = await Reservation.countDocuments({
      spaceId: existing._id,
    }).exec();

    if (reservationCount > 0) {
      throw new ConflictException(
        "Impossible de supprimer définitivement : des réservations historiques référencent cet espace.",
      );
    }

    await this.uploads.deleteSpaceDirectory(id);
    await existing.deleteOne();

    return { ok: true as const };
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

    assertSpaceMutable(existing.status);

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

    try {
      existing.photos.push(nextPhoto);
      await existing.save();
    } catch (error) {
      await this.uploads.deletePhotoFile(storageKey);
      throw error;
    }

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

    assertSpaceMutable(existing.status);

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

    assertSpaceMutable(existing.status);

    const knownKeys = new Set(existing.photos.map((photo) => photo.storageKey));
    for (const photo of parsed.data.photos) {
      if (!isValidSpacePhotoStorageKey(photo.storageKey) || !knownKeys.has(photo.storageKey)) {
        throw new BadRequestException("Unknown photo");
      }
      if (!photo.storageKey.startsWith(`spaces/${id}/`)) {
        throw new BadRequestException("Invalid photo");
      }
    }

    const removedKeys = collectRemovedStorageKeys(existing.photos, parsed.data.photos);
    existing.photos = normalizePhotoMetadata(parsed.data.photos);
    await existing.save();

    for (const storageKey of removedKeys) {
      await this.uploads.deletePhotoFile(storageKey);
    }

    const saved = await Space.findById(existing._id).lean().exec();
    if (!saved) {
      throw new NotFoundException();
    }

    return SpaceResponseSchema.parse(
      mapSpaceToResponse({ ...saved, _id: saved._id as Types.ObjectId }),
    );
  }
}
