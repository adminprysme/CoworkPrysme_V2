import { Module } from "@nestjs/common";

import { BookingModule } from "../booking/booking.module.js";
import { MailModule } from "../mail/mail.module.js";
import { QuotesPaymentModule } from "../quotes-payment/quotes-payment.module.js";
import { AwaitingPaymentExpiryService } from "./awaiting-payment-expiry.service.js";
import { BookingPaymentController } from "./booking-payment.controller.js";
import { BookingPaymentService } from "./booking-payment.service.js";
import { StripeWebhookController } from "./stripe-webhook.controller.js";

@Module({
  imports: [MailModule, BookingModule, QuotesPaymentModule],
  controllers: [BookingPaymentController, StripeWebhookController],
  providers: [BookingPaymentService, AwaitingPaymentExpiryService],
  exports: [BookingPaymentService, AwaitingPaymentExpiryService],
})
export class StripeModule {}
