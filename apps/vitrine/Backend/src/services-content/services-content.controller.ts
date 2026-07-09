import { Controller, Get } from "@nestjs/common";
import { ServicesPublicContentSchema } from "@coworkprysme/shared";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { ServicesContentService } from "./services-content.service.js";

@Controller("services-content")
export class ServicesContentController {
  constructor(private readonly servicesContent: ServicesContentService) {}

  @Get()
  async getServicesContent() {
    const payload = await this.servicesContent.getPublicContent();
    return ServicesPublicContentSchema.parse(payload);
  }
}
