import { Module } from "@nestjs/common";

import { AdminGuard } from "./admin.guard.js";
import { AuthConfigService } from "./auth-config.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { CentraleClient } from "./centrale.client.js";
import { PrysmaUserReadService } from "./prysma-user.read.service.js";
import { SessionGuard } from "./session.guard.js";
import { SessionService } from "./session.service.js";
import { SpacesPermissionGuard } from "./spaces-permission.guard.js";
import { StaffBootstrapService } from "./staff-bootstrap.service.js";
import { StaffContextService } from "./staff-context.service.js";

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
    AdminGuard,
    StaffContextService,
    SpacesPermissionGuard,
  ],
  exports: [
    AuthService,
    SessionGuard,
    SessionService,
    AdminGuard,
    StaffContextService,
    SpacesPermissionGuard,
  ],
})
export class AuthModule {}
