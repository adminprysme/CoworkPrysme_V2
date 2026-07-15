import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CreateDiscountCodeRequestSchema,
  DiscountCodeValidationError,
  DiscountCodesListResponseSchema,
  DiscountCodeResponseSchema,
  UpdateDiscountCodeRequestSchema,
  assertDiscountCodeDateRange,
  assertDiscountCodeServiceTargets,
  mapDiscountCodeToResponse,
  mapDiscountValueToDb,
  mapFixedDiscountEurosToDb,
  type CreateDiscountCodeRequest,
  type DiscountAppliesTo,
  type DiscountPerimeterInput,
  type DiscountType,
  type UpdateDiscountCodeRequest,
} from "@coworkprysme/shared";
import { connectMongo, getDiscountCodeModel } from "@coworkprysme/db";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { ServicesService } from "../services/services.service.js";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

function isObjectId(value: string): boolean {
  return OBJECT_ID_PATTERN.test(value);
}

@Injectable()
export class DiscountCodesService {
  constructor(private readonly services: ServicesService) {}

  async list() {
    await connectMongo();
    const DiscountCode = await getDiscountCodeModel();
    const discountCodes = await DiscountCode.find({ kind: "promo" })
      .sort({ code: 1 })
      .lean()
      .exec();

    return DiscountCodesListResponseSchema.parse({
      discountCodes: discountCodes.map((doc) =>
        mapDiscountCodeToResponse(doc as Parameters<typeof mapDiscountCodeToResponse>[0]),
      ),
    });
  }

  async listServiceOptions() {
    return this.services.listPromoEligibility();
  }

  async getById(id: string) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    await connectMongo();
    const DiscountCode = await getDiscountCodeModel();
    const doc = await DiscountCode.findOne({ _id: id, kind: "promo" }).lean().exec();
    if (!doc) {
      throw new NotFoundException();
    }

    return DiscountCodeResponseSchema.parse(
      mapDiscountCodeToResponse(doc as Parameters<typeof mapDiscountCodeToResponse>[0]),
    );
  }

  async create(input: CreateDiscountCodeRequest) {
    const parsed = CreateDiscountCodeRequestSchema.parse(input);
    await this.validateTargets(parsed.discountType, parsed.perimeter);

    const expiresAt = new Date(parsed.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException("Date d'expiration invalide");
    }
    if (expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("La date d'expiration doit être dans le futur");
    }

    let startsAt: Date | undefined;
    if (parsed.startsAt) {
      startsAt = new Date(parsed.startsAt);
      if (Number.isNaN(startsAt.getTime())) {
        throw new BadRequestException("Date de début invalide");
      }
    }

    try {
      assertDiscountCodeDateRange(startsAt, expiresAt);
    } catch (error) {
      if (error instanceof DiscountCodeValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    await connectMongo();
    const DiscountCode = await getDiscountCodeModel();

    try {
      const created = await DiscountCode.create({
        code: parsed.code,
        kind: "promo",
        discountType: parsed.discountType,
        value: mapDiscountValueToDb(parsed),
        perimeter: {
          appliesTo: parsed.perimeter.appliesTo,
          serviceKeys:
            parsed.perimeter.appliesTo === "service" ? parsed.perimeter.serviceKeys : undefined,
        },
        stackable: parsed.stackable,
        startsAt,
        expiresAt,
        maxUses: parsed.maxUses,
        usedCount: 0,
        status: parsed.status,
      });

      return DiscountCodeResponseSchema.parse(
        mapDiscountCodeToResponse(
          created.toObject() as Parameters<typeof mapDiscountCodeToResponse>[0],
        ),
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException("Ce code promo existe déjà");
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateDiscountCodeRequest) {
    if (!isObjectId(id)) {
      throw new NotFoundException();
    }

    const parsed = UpdateDiscountCodeRequestSchema.parse(input);
    if (Object.keys(parsed).length === 0) {
      throw new BadRequestException("Empty update payload");
    }

    await connectMongo();
    const DiscountCode = await getDiscountCodeModel();
    const existing = await DiscountCode.findOne({ _id: id, kind: "promo" }).exec();
    if (!existing) {
      throw new NotFoundException();
    }

    const nextDiscountType = parsed.discountType ?? existing.discountType;
    const nextPerimeter: DiscountPerimeterInput = parsed.perimeter ?? {
      appliesTo: existing.perimeter.appliesTo as DiscountAppliesTo,
      serviceKeys: existing.perimeter.serviceKeys,
    };

    await this.validateTargets(nextDiscountType, nextPerimeter);

    if (parsed.code !== undefined) {
      existing.code = parsed.code;
    }
    if (parsed.discountType !== undefined) {
      existing.discountType = parsed.discountType;
    }
    if (parsed.valuePercent !== undefined) {
      existing.value = parsed.valuePercent;
    }
    if (parsed.valueEuros !== undefined) {
      existing.value = mapFixedDiscountEurosToDb(parsed.valueEuros);
    }
    if (parsed.discountType === "buy_one_get_one") {
      existing.value = 0;
    }
    if (parsed.perimeter !== undefined) {
      existing.perimeter = {
        appliesTo: parsed.perimeter.appliesTo,
        serviceKeys:
          parsed.perimeter.appliesTo === "service" ? parsed.perimeter.serviceKeys : undefined,
      };
    }
    if (parsed.stackable !== undefined) {
      existing.stackable = parsed.stackable;
    }
    if (parsed.startsAt !== undefined) {
      if (parsed.startsAt === null) {
        existing.startsAt = undefined;
      } else {
        const startsAt = new Date(parsed.startsAt);
        if (Number.isNaN(startsAt.getTime())) {
          throw new BadRequestException("Date de début invalide");
        }
        existing.startsAt = startsAt;
      }
    }
    if (parsed.expiresAt !== undefined) {
      const expiresAt = new Date(parsed.expiresAt);
      if (Number.isNaN(expiresAt.getTime())) {
        throw new BadRequestException("Date d'expiration invalide");
      }
      existing.expiresAt = expiresAt;
    }
    if (parsed.maxUses !== undefined) {
      existing.maxUses = parsed.maxUses ?? undefined;
    }
    if (parsed.status !== undefined) {
      existing.status = parsed.status;
    }

    try {
      assertDiscountCodeDateRange(existing.startsAt, existing.expiresAt);
    } catch (error) {
      if (error instanceof DiscountCodeValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    try {
      await existing.save();
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException("Ce code promo existe déjà");
      }
      throw error;
    }

    return DiscountCodeResponseSchema.parse(
      mapDiscountCodeToResponse(
        existing.toObject() as Parameters<typeof mapDiscountCodeToResponse>[0],
      ),
    );
  }

  private async validateTargets(discountType: DiscountType, perimeter: DiscountPerimeterInput) {
    const catalog = await this.services.listPromoEligibility();
    try {
      assertDiscountCodeServiceTargets({ discountType, perimeter }, catalog);
    } catch (error) {
      if (error instanceof DiscountCodeValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
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
