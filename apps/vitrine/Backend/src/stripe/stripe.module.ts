import { Module } from "@nestjs/common";

import { BookingModule } from "../booking/booking.module.js";
import { MailModule } from "../mail/mail.module.js";
import { BookingPaymentController } from "./booking-payment.controller.js";
import { BookingPaymentService } from "./booking-payment.service.js";
import { StripeWebhookController } from "./stripe-webhook.controller.js";

@Module({
  imports: [MailModule, BookingModule],
  controllers: [BookingPaymentController, StripeWebhookController],
  providers: [BookingPaymentService],
  exports: [BookingPaymentService],
})
export class StripeModule {}
