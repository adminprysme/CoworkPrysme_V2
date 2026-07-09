import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { UploadsModule } from "../uploads/uploads.module.js";
import { VitrineContentController } from "./vitrine-content.controller.js";
import { VitrineContentService } from "./vitrine-content.service.js";

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [VitrineContentController],
  providers: [VitrineContentService],
  exports: [VitrineContentService],
})
export class VitrineContentModule {}
