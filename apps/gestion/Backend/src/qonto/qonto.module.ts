import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { QontoApiClient } from "./qonto-api.client.js";
import { QontoAuthService } from "./qonto-auth.service.js";
import { QontoConfigService } from "./qonto-config.service.js";
import { QontoController } from "./qonto.controller.js";
import { QontoSyncService } from "./qonto-sync.service.js";

@Module({
  imports: [AuthModule],
  controllers: [QontoController],
  providers: [QontoConfigService, QontoAuthService, QontoApiClient, QontoSyncService],
  exports: [QontoConfigService, QontoAuthService, QontoApiClient, QontoSyncService],
})
export class QontoModule {}
