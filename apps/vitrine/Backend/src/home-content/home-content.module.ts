import { Module } from "@nestjs/common";

import { DbModule } from "../db/db.module.js";
import { HomeContentController } from "./home-content.controller.js";
import { HomeContentService } from "./home-content.service.js";

@Module({
  imports: [DbModule],
  controllers: [HomeContentController],
  providers: [HomeContentService],
})
export class HomeContentModule {}
