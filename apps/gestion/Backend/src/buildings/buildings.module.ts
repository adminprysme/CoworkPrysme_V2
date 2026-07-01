import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { GeocodingModule } from "../geocoding/geocoding.module.js";
import { UploadsModule } from "../uploads/uploads.module.js";
import { BuildingsController } from "./buildings.controller.js";
import { BuildingsService } from "./buildings.service.js";

@Module({
  imports: [AuthModule, GeocodingModule, UploadsModule],
  controllers: [BuildingsController],
  providers: [BuildingsService],
})
export class BuildingsModule {}
