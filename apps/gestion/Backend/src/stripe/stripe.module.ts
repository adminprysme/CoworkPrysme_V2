import { Module } from "@nestjs/common";

import { StripeRefundService } from "./stripe-refund.service.js";

@Module({
  providers: [StripeRefundService],
  exports: [StripeRefundService],
})
export class StripeModule {}
