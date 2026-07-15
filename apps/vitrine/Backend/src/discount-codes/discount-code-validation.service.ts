import { BadRequestException, Injectable } from "@nestjs/common";
import {
  DISCOUNT_CODE_INVALID_MESSAGE,
  DiscountCodeValidationError,
  assertDiscountCodeApplicable,
  assertDiscountCodeServiceTargets,
  type DiscountCodeStatus,
  type DiscountCodeTargetInput,
} from "@coworkprysme/shared";
import { connectMongo, getServiceModel } from "@coworkprysme/db";

export interface DiscountCodeApplicabilityInput {
  status: DiscountCodeStatus;
  startsAt?: Date;
  expiresAt: Date;
  maxUses?: number;
  usedCount: number;
}

@Injectable()
export class DiscountCodeValidationService {
  /**
   * Phase 2 booking tunnel — POST /booking/price must call this after loading a code
   * by public value. Rejects scheduled, expired, exhausted and disabled codes with the
   * same generic message to avoid leaking future promo codes.
   */
  assertApplicable(input: DiscountCodeApplicabilityInput, now: Date = new Date()): void {
    try {
      assertDiscountCodeApplicable(input, now);
    } catch (error) {
      if (error instanceof DiscountCodeValidationError) {
        throw new BadRequestException({
          message: DISCOUNT_CODE_INVALID_MESSAGE,
        });
      }
      throw error;
    }
  }

  async assertServiceTargets(input: DiscountCodeTargetInput): Promise<void> {
    const catalog = await this.loadServiceCatalog(input.perimeter.serviceKeys ?? []);
    try {
      assertDiscountCodeServiceTargets(input, catalog);
    } catch (error) {
      if (error instanceof DiscountCodeValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async loadServiceCatalog(serviceKeys: string[]) {
    await connectMongo();
    const Service = await getServiceModel();
    const filter = serviceKeys.length > 0 ? { key: { $in: serviceKeys } } : {};
    const services = await Service.find(filter, {
      key: 1,
      label: 1,
      promoEligible: 1,
      status: 1,
    })
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
