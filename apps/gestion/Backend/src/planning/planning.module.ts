import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { InvoicePdfModule } from "../invoice-pdf/invoice-pdf.module.js";
import { MailModule } from "../mail/mail.module.js";
import { StripeModule } from "../stripe/stripe.module.js";
import { PlanningController } from "./planning.controller.js";
import { PlanningManageService } from "./planning-manage.service.js";
import { PlanningService } from "./planning.service.js";

@Module({
  imports: [AuthModule, MailModule, InvoicePdfModule, StripeModule],
  controllers: [PlanningController],
  providers: [PlanningService, PlanningManageService],
})
export class PlanningModule {}
