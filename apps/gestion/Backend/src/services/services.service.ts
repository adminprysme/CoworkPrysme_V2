import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CreateServiceRequestSchema,
  ServicesListResponseSchema,
  ServiceResponseSchema,
  UpdateServiceRequestSchema,
  baseKeyForServiceLabel,
  mapCreateServiceRequestToDb,
  mapServicePriceEurosToDb,
  mapServiceToResponse,
  resolveUniqueServiceKey,
  type CreateServiceRequest,
  type UpdateServiceRequest,
} from "@coworkprysme/shared";
import { connectMongo, getServiceModel } from "@coworkprysme/db";
import type { Types } from "mongoose";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

function isObjectId(value: string): boolean {
  return OBJECT_ID_PATTERN.test(value);
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

@Injectable()
export class ServicesService {
  async list(status: "all" | "active" | "inactive" = "all") {
    await connectMongo();
    const Service = await getServiceModel();
    const filter =
      status === "all"
        ? {}
        : {
            status,
          };

    const services = await Service.find(filter).sort({ label: 1 }).lean().exec();
    return ServicesListResponseSchema.parse({
      services: services.map((doc) =>
        mapServiceToResponse(doc as Parameters<typeof mapServiceToResponse>[0]),
      ),
    });
  }

  async getById(id: string) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    await connectMongo();
    const Service = await getServiceModel();
    const doc = await Service.findById(id).lean().exec();
    if (!doc) {
      throw new NotFoundException();
    }

    return ServiceResponseSchema.parse(
      mapServiceToResponse(doc as Parameters<typeof mapServiceToResponse>[0]),
    );
  }

  async create(input: CreateServiceRequest) {
    const parsed = CreateServiceRequestSchema.parse(input);
    await connectMongo();
    const Service = await getServiceModel();
    const key = await resolveUniqueServiceKeyForLabel(parsed.label);

    try {
      const created = await Service.create(mapCreateServiceRequestToDb(parsed, key));
      return ServiceResponseSchema.parse(
        mapServiceToResponse(created.toObject() as Parameters<typeof mapServiceToResponse>[0]),
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException("Un service avec cette clé existe déjà");
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateServiceRequest) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    const parsed = UpdateServiceRequestSchema.parse(input);
    if (Object.keys(parsed).length === 0) {
      throw new BadRequestException("Empty update payload");
    }

    await connectMongo();
    const Service = await getServiceModel();
    const existing = await Service.findById(id).exec();
    if (!existing) {
      throw new NotFoundException();
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

    await existing.save();
    return ServiceResponseSchema.parse(
      mapServiceToResponse(existing.toObject() as Parameters<typeof mapServiceToResponse>[0]),
    );
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
  _id: Types.ObjectId;
  key: string;
  label: string;
  promoEligible: boolean;
  status: "active" | "inactive";
};
