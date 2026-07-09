import { Controller, Get, Param } from "@nestjs/common";
import {
  CatalogBuildingPageContentSchema,
  CatalogBuildingsListSchema,
  CatalogTariffsContentSchema,
} from "@coworkprysme/shared";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { CatalogContentService } from "./catalog-content.service.js";

@Controller("catalog")
export class CatalogContentController {
  constructor(private readonly catalogContent: CatalogContentService) {}

  @Get("buildings")
  async listBuildings() {
    const payload = await this.catalogContent.listBuildings();
    return CatalogBuildingsListSchema.parse(payload);
  }

  @Get("buildings/:slug/private-offices")
  async getPrivateOffices(@Param("slug") slug: string) {
    const payload = await this.catalogContent.getBuildingSpacesPage(slug, "private_office");
    return CatalogBuildingPageContentSchema.parse(payload);
  }

  @Get("buildings/:slug/meeting-rooms")
  async getMeetingRooms(@Param("slug") slug: string) {
    const payload = await this.catalogContent.getBuildingSpacesPage(slug, "meeting_room");
    return CatalogBuildingPageContentSchema.parse(payload);
  }

  @Get("tariffs/:slug")
  async getTariffs(@Param("slug") slug: string) {
    const payload = await this.catalogContent.getTariffsPage(slug);
    return CatalogTariffsContentSchema.parse(payload);
  }
}
