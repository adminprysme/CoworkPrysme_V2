import { Module } from "@nestjs/common";

import { DbModule } from "../db/db.module.js";
import { CatalogContentController } from "./catalog-content.controller.js";
import { CatalogContentService } from "./catalog-content.service.js";

@Module({
  imports: [DbModule],
  controllers: [CatalogContentController],
  providers: [CatalogContentService],
})
export class CatalogContentModule {}
