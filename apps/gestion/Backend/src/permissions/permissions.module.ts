import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { PermissionsController } from "./permissions.controller.js";
import { PermissionsService } from "./permissions.service.js";
import { PrysmaDirectoryReadService } from "./prysma-directory.read.service.js";

@Module({
  imports: [AuthModule],
  controllers: [PermissionsController],
  providers: [PermissionsService, PrysmaDirectoryReadService],
})
export class PermissionsModule {}
