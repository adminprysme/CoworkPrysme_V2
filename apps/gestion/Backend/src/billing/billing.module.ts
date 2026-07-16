import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { MailModule } from "../mail/mail.module.js";
import { BillingController } from "./billing.controller.js";
import { BillingService } from "./billing.service.js";

@Module({
  imports: [AuthModule, MailModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
