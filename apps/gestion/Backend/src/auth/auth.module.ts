import { Module } from "@nestjs/common";

import { AuthConfigService } from "./auth-config.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { CentraleClient } from "./centrale.client.js";
import { PrysmaUserReadService } from "./prysma-user.read.service.js";
import { SessionGuard } from "./session.guard.js";
import { SessionService } from "./session.service.js";
import { StaffBootstrapService } from "./staff-bootstrap.service.js";

@Module({
  controllers: [AuthController],
  providers: [
    AuthConfigService,
    AuthService,
    SessionService,
    StaffBootstrapService,
    CentraleClient,
    PrysmaUserReadService,
    SessionGuard,
  ],
  exports: [AuthService, SessionGuard, SessionService],
})
export class AuthModule {}
