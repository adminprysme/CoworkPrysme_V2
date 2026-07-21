import { Module } from "@nestjs/common";

import { MailModule } from "../mail/mail.module.js";
import { StripeRefundService } from "./stripe-refund.service.js";
import { StripeRefundWebhookService } from "./stripe-refund-webhook.service.js";
import { StripeWebhookController } from "./stripe-webhook.controller.js";

@Module({
  imports: [MailModule],
  controllers: [StripeWebhookController],
  providers: [StripeRefundService, StripeRefundWebhookService],
  exports: [StripeRefundService],
})
export class StripeModule {}
