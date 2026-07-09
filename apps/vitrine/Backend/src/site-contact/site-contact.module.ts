import { Module } from "@nestjs/common";

import { SiteContactController } from "./site-contact.controller.js";
import { SiteContactService } from "./site-contact.service.js";

@Module({
  controllers: [SiteContactController],
  providers: [SiteContactService],
})
export class SiteContactModule {}
