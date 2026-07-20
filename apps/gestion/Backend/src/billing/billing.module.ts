import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { InvoicePdfModule } from "../invoice-pdf/invoice-pdf.module.js";
import { MailModule } from "../mail/mail.module.js";
import { BillingController } from "./billing.controller.js";
import { BillingService } from "./billing.service.js";

@Module({
  imports: [AuthModule, MailModule, InvoicePdfModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
