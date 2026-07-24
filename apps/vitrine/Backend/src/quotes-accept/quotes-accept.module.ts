import { Module } from "@nestjs/common";

import { QuotesAcceptController } from "./quotes-accept.controller.js";
import { QuotesAcceptService } from "./quotes-accept.service.js";

@Module({
  controllers: [QuotesAcceptController],
  providers: [QuotesAcceptService],
})
export class QuotesAcceptModule {}
