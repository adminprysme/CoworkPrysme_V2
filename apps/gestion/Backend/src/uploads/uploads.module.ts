import { Module } from "@nestjs/common";

import { MediaController } from "./media.controller.js";
import { UploadsService } from "./uploads.service.js";

@Module({
  controllers: [MediaController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
