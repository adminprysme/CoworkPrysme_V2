import { Module } from "@nestjs/common";

import { AccountActivationController } from "./account-activation.controller.js";
import { AccountActivationService } from "./account-activation.service.js";

@Module({
  controllers: [AccountActivationController],
  providers: [AccountActivationService],
})
export class AccountActivationModule {}
