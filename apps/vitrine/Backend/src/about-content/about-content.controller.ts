import { Controller, Get } from "@nestjs/common";
import { AboutPublicContentSchema } from "@coworkprysme/shared";

import { buildPublicImageUrl } from "../home-content/home-content.controller.js";
/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { AboutContentService } from "./about-content.service.js";

@Controller("about-content")
export class AboutContentController {
  constructor(private readonly aboutContent: AboutContentService) {}

  @Get()
  async getAboutContent() {
    const payload = await this.aboutContent.getPublicContent();
    return AboutPublicContentSchema.parse(payload);
  }
}

export function mergeAboutPublicContent(stored: { placeImage: string | null }, apiOrigin: string) {
  return {
    placeImage: stored.placeImage
      ? buildPublicImageUrl(stored.placeImage, stored.placeImage, apiOrigin)
      : null,
  };
}
