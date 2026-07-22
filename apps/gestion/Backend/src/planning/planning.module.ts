import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { DocumentStorageModule } from "../document-storage/document-storage.module.js";
import { InvoicePdfModule } from "../invoice-pdf/invoice-pdf.module.js";
import { MailModule } from "../mail/mail.module.js";
import { StripeModule } from "../stripe/stripe.module.js";
import {
  CardexesStaffController,
  ClientAccountsStaffController,
} from "./client-accounts-staff.controller.js";
import { ClientAccountsStaffService } from "./client-accounts-staff.service.js";
import { CardexDocumentsController } from "./cardex-documents.controller.js";
import { CardexDocumentsService } from "./cardex-documents.service.js";
import { CardexInvoicesController } from "./cardex-invoices.controller.js";
import { CardexInvoicesService } from "./cardex-invoices.service.js";
import { PlanningController } from "./planning.controller.js";
import { PlanningInvitationsService } from "./planning-invitations.service.js";
import { PlanningManageService } from "./planning-manage.service.js";
import { PlanningService } from "./planning.service.js";

@Module({
  imports: [AuthModule, MailModule, InvoicePdfModule, StripeModule, DocumentStorageModule],
  controllers: [
    PlanningController,
    ClientAccountsStaffController,
    CardexesStaffController,
    CardexDocumentsController,
    CardexInvoicesController,
  ],
  providers: [
    PlanningService,
    PlanningManageService,
    PlanningInvitationsService,
    ClientAccountsStaffService,
    CardexDocumentsService,
    CardexInvoicesService,
  ],
})
export class PlanningModule {}
