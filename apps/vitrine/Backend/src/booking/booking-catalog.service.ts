import { Injectable } from "@nestjs/common";
import type { Service } from "@coworkprysme/db";
import { connectMongo, getServiceModel } from "@coworkprysme/db";
import {
  BookingServicesResponseSchema,
  mapServiceCustomQuestionsToResponse,
  type BookingServiceCatalogItem,
  type BookingServicesQuery,
} from "@coworkprysme/shared";
import type { Types } from "mongoose";

import { buildPublicImageUrl } from "../home-content/home-content.controller.js";
import { toObjectId } from "./object-id.util.js";

type ServiceLean = Service & { _id: Types.ObjectId };

@Injectable()
export class BookingCatalogService {
  private getApiOrigin(): string {
    const port = Number(process.env.PORT ?? 8002);
    return process.env.VITRINE_API_PUBLIC_ORIGIN?.replace(/\/$/, "") ?? `http://localhost:${port}`;
  }

  private mapServiceToCatalogItem(service: ServiceLean): BookingServiceCatalogItem {
    const apiOrigin = this.getApiOrigin();
    const photo = service.photo?.storageKey
      ? {
          storageKey: service.photo.storageKey,
          url: buildPublicImageUrl(service.photo.storageKey, "", apiOrigin),
          alt: service.photo.alt?.trim() || undefined,
        }
      : undefined;

    return {
      id: service._id.toString(),
      key: service.key,
      label: service.label,
      description: service.description?.trim() || undefined,
      priceHTCents: service.priceHT,
      vatRate: service.vatRate,
      promoEligible: service.promoEligible,
      customQuestions: mapServiceCustomQuestionsToResponse(service.customQuestions),
      photo,
    };
  }

  async listServicesForBuilding(query: BookingServicesQuery) {
    await connectMongo();
    const buildingObjectId = toObjectId(query.buildingId);
    const Service = await getServiceModel();
    const services = await Service.find({
      status: "active",
      $or: [{ isGlobal: true }, { buildingIds: buildingObjectId }],
    })
      .sort({ label: 1 })
      .lean()
      .exec();

    return BookingServicesResponseSchema.parse({
      services: (services as ServiceLean[]).map((service) => this.mapServiceToCatalogItem(service)),
    });
  }
}
