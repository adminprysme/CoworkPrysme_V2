import { BadRequestException, Injectable } from "@nestjs/common";
import {
  DiscountCodeValidationError,
  assertDiscountCodeServiceTargets,
  type DiscountCodeTargetInput,
} from "@coworkprysme/shared";
import { connectMongo, getServiceModel } from "@coworkprysme/db";

@Injectable()
export class DiscountCodeValidationService {
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
