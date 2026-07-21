import { Module } from "@nestjs/common";

import { MailModule } from "../mail/mail.module.js";
import { InvitationsController } from "./invitations.controller.js";
import { InvitationsService } from "./invitations.service.js";

@Module({
  imports: [MailModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
