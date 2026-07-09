import { Controller, Get } from "@nestjs/common";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { SiteContactService } from "./site-contact.service.js";

@Controller("site-contact")
export class SiteContactController {
  constructor(private readonly siteContact: SiteContactService) {}

  @Get()
  getSiteContact() {
    return this.siteContact.getPublicBuildingInfo();
  }
}
