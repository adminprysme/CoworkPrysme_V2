import { Module } from "@nestjs/common";

import { DbModule } from "../db/db.module.js";
import { AboutContentController } from "./about-content.controller.js";
import { AboutContentService } from "./about-content.service.js";

@Module({
  imports: [DbModule],
  controllers: [AboutContentController],
  providers: [AboutContentService],
})
export class AboutContentModule {}
