import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { InvoicePdfModule } from "../invoice-pdf/invoice-pdf.module.js";
import { MailModule } from "../mail/mail.module.js";
import { BillingController } from "./billing.controller.js";
import { BillingService } from "./billing.service.js";
import { QuotesController } from "./quotes.controller.js";
import { QuotesLocksService } from "./quotes-locks.service.js";
import { QuotesService } from "./quotes.service.js";

@Module({
  imports: [AuthModule, MailModule, InvoicePdfModule],
  controllers: [BillingController, QuotesController],
  providers: [BillingService, QuotesService, QuotesLocksService],
})
export class BillingModule {}
