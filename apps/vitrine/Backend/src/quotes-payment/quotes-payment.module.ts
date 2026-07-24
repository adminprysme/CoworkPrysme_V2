import { Module } from "@nestjs/common";

import { QuotePaymentController } from "./quote-payment.controller.js";
import { QuotePaymentService } from "./quote-payment.service.js";

@Module({
  controllers: [QuotePaymentController],
  providers: [QuotePaymentService],
  exports: [QuotePaymentService],
})
export class QuotesPaymentModule {}
