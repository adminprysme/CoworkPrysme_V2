import { Module } from "@nestjs/common";

import { DiscountCodeValidationService } from "./discount-code-validation.service.js";

@Module({
  providers: [DiscountCodeValidationService],
  exports: [DiscountCodeValidationService],
})
export class DiscountCodesModule {}
