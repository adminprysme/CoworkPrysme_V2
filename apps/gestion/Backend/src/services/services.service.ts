import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CreateServiceRequestSchema,
  ServiceAccessError,
  ServicesListResponseSchema,
  ServiceResponseSchema,
  UpdateServiceRequestSchema,
  assertServiceContentUpdateAllowed,
  assertServiceCreateAllowed,
  assertServiceDeleteAllowed,
  assertServicePhotoMutationAllowed,
  baseKeyForServiceLabel,
  getServiceListFilter,
  isValidServicePhotoStorageKey,
  mapCreateServiceRequestToDb,
  mapServicePriceEurosToDb,
  mapServiceToResponse,
  normalizeServiceBuildingIds,
  normalizeServiceCustomQuestions,
  resolveServiceBuildingIdsForUpdate,
  resolveUniqueServiceKey,
  toServiceAccessProfile,
  toServiceRecordForAccess,
  type CreateServiceRequest,
  type ServiceBuildingSummary,
  type UpdateServiceRequest,
} from "@coworkprysme/shared";
import {
  connectMongo,
  getBuildingModel,
  getServiceModel,
  type ServiceDocument,
  type StaffProfileDocument,
} from "@coworkprysme/db";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { UploadsService } from "../uploads/uploads.service.js";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

function isObjectId(value: string): boolean {
  return OBJECT_ID_PATTERN.test(value);
}

function mapServiceDocumentToDbShape(doc: unknown) {
  const record = doc as ServiceDocument & {
    buildingIds?: Array<{ toString(): string }>;
    photo?: { storageKey: string; alt?: string };
  };

  return {
    _id: record._id,
    key: record.key,
    label: record.label,
    description: record.description,
    priceHT: record.priceHT,
    vatRate: record.vatRate,
    promoEligible: record.promoEligible,
    status: record.status,
    customQuestions: record.customQuestions ?? [],
    photo: record.photo,
    isGlobal: record.isGlobal ?? true,
    buildingIds: (record.buildingIds ?? []).map((id) => id.toString()),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function throwAccessError(error: ServiceAccessError): never {
  throw new ForbiddenException(error.message);
}

async function resolveUniqueServiceKeyForLabel(label: string, excludeId?: string): Promise<string> {
  await connectMongo();
  const Service = await getServiceModel();
  const existing = await Service.find(excludeId ? { _id: { $ne: excludeId } } : {}, { key: 1 })
    .lean()
    .exec();
  const takenKeys = new Set(existing.map((doc) => doc.key));
  const baseKey = baseKeyForServiceLabel(label);
  return resolveUniqueServiceKey(baseKey, takenKeys);
}

async function resolveBuildingSummaries(buildingIds: string[]): Promise<ServiceBuildingSummary[]> {
  if (buildingIds.length === 0) {
    return [];
  }

  await connectMongo();
  const Building = await getBuildingModel();
  const docs = await Building.find({ _id: { $in: buildingIds } }, { name: 1 })
    .lean()
    .exec();

  const byId = new Map(docs.map((doc) => [doc._id.toString(), doc.name]));
  return normalizeServiceBuildingIds(buildingIds)
    .filter((id) => byId.has(id))
    .map((id) => ({ id, name: byId.get(id)! }));
}

@Injectable()
export class ServicesService {
  constructor(private readonly uploads: UploadsService) {}

  async list(profile: StaffProfileDocument, status: "all" | "active" | "inactive" = "all") {
    await connectMongo();
    const Service = await getServiceModel();
    const accessProfile = toServiceAccessProfile(profile);
    const statusFilter =
      status === "all"
        ? {}
        : {
            status,
          };

    const services = await Service.find({ ...getServiceListFilter(accessProfile), ...statusFilter })
      .sort({ label: 1 })
      .lean()
      .exec();

    return ServicesListResponseSchema.parse({
      services: await Promise.all(
        services.map(async (doc) => {
          const shape = mapServiceDocumentToDbShape(doc);
          const buildings = await resolveBuildingSummaries(shape.buildingIds);
          return mapServiceToResponse(shape, { buildings });
        }),
      ),
    });
  }

  async getById(id: string, profile: StaffProfileDocument) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    await connectMongo();
    const Service = await getServiceModel();
    const doc = await Service.findById(id).lean().exec();
    if (!doc) {
      throw new NotFoundException();
    }

    const accessProfile = toServiceAccessProfile(profile);
    const listFilter = getServiceListFilter(accessProfile);
    if (Object.keys(listFilter).length > 0) {
      const visible = await Service.findOne({ _id: id, ...listFilter })
        .lean()
        .exec();
      if (!visible) {
        throw new NotFoundException();
      }
    }

    const shape = mapServiceDocumentToDbShape(doc);
    const buildings = await resolveBuildingSummaries(shape.buildingIds);
    return ServiceResponseSchema.parse(mapServiceToResponse(shape, { buildings }));
  }

  async create(input: CreateServiceRequest, profile: StaffProfileDocument) {
    const parsed = CreateServiceRequestSchema.parse(input);
    const accessProfile = toServiceAccessProfile(profile);

    try {
      assertServiceCreateAllowed(accessProfile, {
        isGlobal: parsed.isGlobal,
        buildingIds: parsed.buildingIds,
      });
    } catch (error) {
      if (error instanceof ServiceAccessError) {
        throwAccessError(error);
      }
      throw error;
    }

    await connectMongo();
    const Service = await getServiceModel();
    const key = await resolveUniqueServiceKeyForLabel(parsed.label);
    const dbPayload = mapCreateServiceRequestToDb(parsed, key);

    try {
      const created = await Service.create(dbPayload);
      const shape = mapServiceDocumentToDbShape(
        created.toObject() as unknown as Record<string, unknown>,
      );
      const buildings = await resolveBuildingSummaries(shape.buildingIds);
      return ServiceResponseSchema.parse(mapServiceToResponse(shape, { buildings }));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException("Un service avec cette clé existe déjà");
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateServiceRequest, profile: StaffProfileDocument) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    const requestedKeys = Object.keys(input);
    if (requestedKeys.length === 0) {
      throw new BadRequestException("Empty update payload");
    }

    const parsed = UpdateServiceRequestSchema.parse(input);

    await connectMongo();
    const Service = await getServiceModel();
    const existing = await Service.findById(id).exec();
    if (!existing) {
      throw new NotFoundException();
    }

    const accessProfile = toServiceAccessProfile(profile);
    const serviceRecord = toServiceRecordForAccess(mapServiceDocumentToDbShape(existing));

    try {
      assertServiceContentUpdateAllowed(accessProfile, serviceRecord, requestedKeys);
    } catch (error) {
      if (error instanceof ServiceAccessError) {
        throwAccessError(error);
      }
      throw error;
    }

    if (parsed.label !== undefined) {
      existing.label = parsed.label.trim();
    }
    if (parsed.description !== undefined) {
      existing.description = parsed.description?.trim() || undefined;
    }
    if (parsed.priceEurosHT !== undefined) {
      existing.priceHT = mapServicePriceEurosToDb(parsed.priceEurosHT);
    }
    if (parsed.vatRate !== undefined) {
      existing.vatRate = parsed.vatRate;
    }
    if (parsed.promoEligible !== undefined) {
      existing.promoEligible = parsed.promoEligible;
    }
    if (parsed.status !== undefined) {
      existing.status = parsed.status;
    }
    if (parsed.customQuestions !== undefined) {
      existing.customQuestions = normalizeServiceCustomQuestions(parsed.customQuestions);
    }

    if (parsed.isGlobal !== undefined || parsed.buildingIds !== undefined) {
      try {
        const resolved = resolveServiceBuildingIdsForUpdate(
          accessProfile,
          {
            isGlobal: existing.isGlobal,
            buildingIds: existing.buildingIds.map((buildingId) => buildingId.toString()),
          },
          parsed.buildingIds,
          parsed.isGlobal,
        );
        existing.isGlobal = resolved.isGlobal;
        existing.buildingIds = resolved.buildingIds as unknown as ServiceDocument["buildingIds"];
      } catch (error) {
        if (error instanceof ServiceAccessError) {
          throwAccessError(error);
        }
        throw error;
      }
    }

    await existing.save();
    const shape = mapServiceDocumentToDbShape(
      existing.toObject() as unknown as Record<string, unknown>,
    );
    const buildings = await resolveBuildingSummaries(shape.buildingIds);
    return ServiceResponseSchema.parse(mapServiceToResponse(shape, { buildings }));
  }

  async delete(id: string, profile: StaffProfileDocument) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    const accessProfile = toServiceAccessProfile(profile);
    try {
      assertServiceDeleteAllowed(accessProfile);
    } catch (error) {
      if (error instanceof ServiceAccessError) {
        throwAccessError(error);
      }
      throw error;
    }

    await connectMongo();
    const Service = await getServiceModel();
    const existing = await Service.findById(id).exec();
    if (!existing) {
      throw new NotFoundException();
    }

    await this.uploads.deleteServiceDirectory(id);
    await existing.deleteOne();
    return { ok: true as const };
  }

  async uploadPhoto(id: string, buffer: Buffer, profile: StaffProfileDocument) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    await connectMongo();
    const Service = await getServiceModel();
    const existing = await Service.findById(id).exec();
    if (!existing) {
      throw new NotFoundException();
    }

    const accessProfile = toServiceAccessProfile(profile);
    const serviceRecord = toServiceRecordForAccess(mapServiceDocumentToDbShape(existing));

    try {
      assertServicePhotoMutationAllowed(accessProfile, serviceRecord);
    } catch (error) {
      if (error instanceof ServiceAccessError) {
        throwAccessError(error);
      }
      throw error;
    }

    const previousStorageKey = existing.photo?.storageKey;
    const { storageKey } = await this.uploads.storeServicePhoto(id, buffer);

    if (!isValidServicePhotoStorageKey(storageKey) || !storageKey.startsWith(`services/${id}/`)) {
      await this.uploads.deletePhotoFile(storageKey);
      throw new BadRequestException("Invalid storage key");
    }

    try {
      existing.photo = { storageKey };
      await existing.save();
      if (previousStorageKey && previousStorageKey !== storageKey) {
        await this.uploads.deletePhotoFile(previousStorageKey);
      }
    } catch (error) {
      await this.uploads.deletePhotoFile(storageKey);
      throw error;
    }

    const shape = mapServiceDocumentToDbShape(
      existing.toObject() as unknown as Record<string, unknown>,
    );
    const buildings = await resolveBuildingSummaries(shape.buildingIds);
    return ServiceResponseSchema.parse(mapServiceToResponse(shape, { buildings }));
  }

  async deletePhoto(id: string, profile: StaffProfileDocument) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    await connectMongo();
    const Service = await getServiceModel();
    const existing = await Service.findById(id).exec();
    if (!existing) {
      throw new NotFoundException();
    }

    const accessProfile = toServiceAccessProfile(profile);
    const serviceRecord = toServiceRecordForAccess(mapServiceDocumentToDbShape(existing));

    try {
      assertServicePhotoMutationAllowed(accessProfile, serviceRecord);
    } catch (error) {
      if (error instanceof ServiceAccessError) {
        throwAccessError(error);
      }
      throw error;
    }

    const storageKey = existing.photo?.storageKey;
    if (!storageKey) {
      throw new NotFoundException();
    }

    existing.photo = undefined;
    await existing.save();
    await this.uploads.deletePhotoFile(storageKey);

    const shape = mapServiceDocumentToDbShape(
      existing.toObject() as unknown as Record<string, unknown>,
    );
    const buildings = await resolveBuildingSummaries(shape.buildingIds);
    return ServiceResponseSchema.parse(mapServiceToResponse(shape, { buildings }));
  }

  async listPromoEligibility() {
    await connectMongo();
    const Service = await getServiceModel();
    const services = await Service.find({}, { key: 1, label: 1, promoEligible: 1, status: 1 })
      .sort({ label: 1 })
      .lean()
      .exec();

    return services.map((service) => ({
      key: service.key,
      label: service.label,
      promoEligible: service.promoEligible,
      status: service.status,
    }));
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

export type ServiceLean = {
  _id: { toString(): string };
  key: string;
  label: string;
  promoEligible: boolean;
  status: "active" | "inactive";
};
