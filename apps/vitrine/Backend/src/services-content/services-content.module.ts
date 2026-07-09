import { Module } from "@nestjs/common";

import { DbModule } from "../db/db.module.js";
import { ServicesContentController } from "./services-content.controller.js";
import { ServicesContentService } from "./services-content.service.js";

@Module({
  imports: [DbModule],
  controllers: [ServicesContentController],
  providers: [ServicesContentService],
})
export class ServicesContentModule {}
