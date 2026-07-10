import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { ServicesModule } from "../services/services.module.js";
import { DiscountCodesController } from "./discount-codes.controller.js";
import { DiscountCodesService } from "./discount-codes.service.js";

@Module({
  imports: [AuthModule, ServicesModule],
  controllers: [DiscountCodesController],
  providers: [DiscountCodesService],
})
export class DiscountCodesModule {}
