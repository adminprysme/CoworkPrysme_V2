import { Module } from "@nestjs/common";

import { BookingPaymentController } from "./booking-payment.controller.js";
import { BookingPaymentService } from "./booking-payment.service.js";
import { StripeWebhookController } from "./stripe-webhook.controller.js";

@Module({
  controllers: [BookingPaymentController, StripeWebhookController],
  providers: [BookingPaymentService],
  exports: [BookingPaymentService],
})
export class StripeModule {}
