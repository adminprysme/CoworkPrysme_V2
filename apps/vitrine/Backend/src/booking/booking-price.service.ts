import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Service, Space } from "@coworkprysme/db";
import { connectMongo, getDiscountCodeModel, getServiceModel } from "@coworkprysme/db";
import {
  BOOKING_ERROR_CODES,
  BookingPriceResponseSchema,
  DISCOUNT_CODE_INVALID_MESSAGE,
  DISCOUNT_CODE_PREFERENTIAL_PENDING_MESSAGE,
  ServiceCustomAnswerValidationError,
  assertServiceCustomAnswers,
  computeBookingPrice,
  mapServiceCustomQuestionsToResponse,
  type BookingPriceLineInput,
  type BookingPriceRequest,
  type BookingPriceServiceInput,
  type ServiceCustomAnswer,
} from "@coworkprysme/shared";
import type { Types } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { DiscountCodeValidationService } from "../discount-codes/discount-code-validation.service.js";
import { AvailabilityService } from "./availability.service.js";
import { toObjectId } from "./object-id.util.js";

type ServiceLean = Service & { _id: Types.ObjectId };
type SpaceLean = Space & { _id: Types.ObjectId };

@Injectable()
export class BookingPriceService {
  constructor(
    private readonly availability: AvailabilityService,
    private readonly discountCodeValidation: DiscountCodeValidationService,
  ) {}

  private isServiceAvailableForBuilding(service: ServiceLean, buildingId: string): boolean {
    if (service.isGlobal) {
      return true;
    }

    return service.buildingIds.some((id) => id.toString() === buildingId);
  }

  private resolveSpaceTariff(
    space: SpaceLean,
    durationClass: BookingPriceRequest["durationClass"],
  ) {
    const tariff = space.tariffs.find(
      (entry) => entry.enabled !== false && entry.durationClass === durationClass,
    );
    if (!tariff) {
      throw new BadRequestException({
        code: BOOKING_ERROR_CODES.VALIDATION_ERROR,
        message: "Tarif indisponible pour cet espace",
      });
    }

    return tariff;
  }

  private async loadActiveServices(
    serviceInputs: readonly BookingPriceServiceInput[],
  ): Promise<Map<string, ServiceLean>> {
    if (serviceInputs.length === 0) {
      return new Map();
    }

    await connectMongo();
    const Service = await getServiceModel();
    const serviceIds = [...new Set(serviceInputs.map((entry) => entry.serviceId))].map(toObjectId);
    const services = await Service.find({
      _id: { $in: serviceIds },
      status: "active",
    })
      .lean()
      .exec();

    return new Map((services as ServiceLean[]).map((service) => [service._id.toString(), service]));
  }

  private buildServiceLines(
    serviceInputs: readonly BookingPriceServiceInput[],
    servicesById: ReadonlyMap<string, ServiceLean>,
    buildingId: string,
  ): BookingPriceLineInput[] {
    return serviceInputs.map((entry) => {
      const service = servicesById.get(entry.serviceId);
      if (!service) {
        throw new NotFoundException({
          code: BOOKING_ERROR_CODES.VALIDATION_ERROR,
          message: "Service indisponible",
        });
      }

      if (!this.isServiceAvailableForBuilding(service, buildingId)) {
        throw new BadRequestException({
          code: BOOKING_ERROR_CODES.VALIDATION_ERROR,
          message: `Le service « ${service.label} » n'est pas disponible pour ce bâtiment`,
        });
      }

      try {
        assertServiceCustomAnswers(
          mapServiceCustomQuestionsToResponse(service.customQuestions),
          entry.customAnswers as ServiceCustomAnswer[] | undefined,
        );
      } catch (error) {
        if (error instanceof ServiceCustomAnswerValidationError) {
          throw new BadRequestException({
            code: BOOKING_ERROR_CODES.VALIDATION_ERROR,
            message: error.message,
          });
        }
        throw error;
      }

      return {
        label: service.label,
        kind: "service",
        refId: service._id.toString(),
        serviceKey: service.key,
        qty: entry.qty,
        unitPriceHT: service.priceHT,
        vatRate: service.vatRate,
      };
    });
  }

  private async resolveDiscount(code: string) {
    await connectMongo();
    const DiscountCode = await getDiscountCodeModel();
    const normalizedCode = code.trim().toUpperCase();
    const discountCode = await DiscountCode.findOne({ code: normalizedCode }).lean().exec();

    if (!discountCode) {
      throw new BadRequestException({ message: DISCOUNT_CODE_INVALID_MESSAGE });
    }

    if (discountCode.kind === "preferential") {
      throw new BadRequestException({ message: DISCOUNT_CODE_PREFERENTIAL_PENDING_MESSAGE });
    }

    if (discountCode.kind !== "promo") {
      throw new BadRequestException({ message: DISCOUNT_CODE_INVALID_MESSAGE });
    }

    this.discountCodeValidation.assertApplicable({
      status: discountCode.status,
      startsAt: discountCode.startsAt,
      expiresAt: discountCode.expiresAt,
      maxUses: discountCode.maxUses,
      usedCount: discountCode.usedCount,
    });

    await this.discountCodeValidation.assertServiceTargets({
      discountType: discountCode.discountType,
      perimeter: {
        appliesTo: discountCode.perimeter.appliesTo as "order" | "service" | "space",
        serviceKeys: discountCode.perimeter.serviceKeys,
      },
    });

    return {
      code: discountCode.code,
      discountType: discountCode.discountType,
      value: discountCode.value,
      perimeter: {
        appliesTo: discountCode.perimeter.appliesTo as "order" | "service" | "space",
        serviceKeys: discountCode.perimeter.serviceKeys,
      },
    };
  }

  async computePrice(input: BookingPriceRequest) {
    const space = await this.availability.getSpaceById(input.spaceId);
    if (!space) {
      throw new NotFoundException({
        code: BOOKING_ERROR_CODES.SPACE_NOT_FOUND,
        message: "Space not found",
      });
    }

    const tariff = this.resolveSpaceTariff(space as SpaceLean, input.durationClass);
    const servicesById = await this.loadActiveServices(input.services);
    const buildingId = (space as SpaceLean).buildingId.toString();

    const lines: BookingPriceLineInput[] = [
      {
        label: space.name,
        kind: "space",
        refId: space._id.toString(),
        qty: 1,
        unitPriceHT: tariff.priceHT,
        vatRate: tariff.vatRate,
      },
      ...this.buildServiceLines(input.services, servicesById, buildingId),
    ];

    const discount = input.discountCode
      ? await this.resolveDiscount(input.discountCode)
      : undefined;

    return BookingPriceResponseSchema.parse(
      computeBookingPrice({
        lines,
        discount: discount
          ? {
              code: discount.code,
              discountType: discount.discountType,
              value: discount.value,
              perimeter: discount.perimeter,
            }
          : undefined,
      }),
    );
  }
}
