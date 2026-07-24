import { Module } from "@nestjs/common";

import { InvoicePdfModule } from "../invoice-pdf/invoice-pdf.module.js";
import { MailModule } from "../mail/mail.module.js";
import { QuotesAcceptController } from "./quotes-accept.controller.js";
import { QuotesAcceptService } from "./quotes-accept.service.js";

@Module({
  imports: [MailModule, InvoicePdfModule],
  controllers: [QuotesAcceptController],
  providers: [QuotesAcceptService],
})
export class QuotesAcceptModule {}
