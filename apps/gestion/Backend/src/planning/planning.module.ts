import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { InvoicePdfModule } from "../invoice-pdf/invoice-pdf.module.js";
import { MailModule } from "../mail/mail.module.js";
import { StripeModule } from "../stripe/stripe.module.js";
import {
  CardexesStaffController,
  ClientAccountsStaffController,
} from "./client-accounts-staff.controller.js";
import { ClientAccountsStaffService } from "./client-accounts-staff.service.js";
import { PlanningController } from "./planning.controller.js";
import { PlanningInvitationsService } from "./planning-invitations.service.js";
import { PlanningManageService } from "./planning-manage.service.js";
import { PlanningService } from "./planning.service.js";

@Module({
  imports: [AuthModule, MailModule, InvoicePdfModule, StripeModule],
  controllers: [PlanningController, ClientAccountsStaffController, CardexesStaffController],
  providers: [
    PlanningService,
    PlanningManageService,
    PlanningInvitationsService,
    ClientAccountsStaffService,
  ],
})
export class PlanningModule {}
