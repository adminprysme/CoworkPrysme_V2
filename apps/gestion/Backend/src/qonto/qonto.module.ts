import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { QontoApiClient } from "./qonto-api.client.js";
import { QontoAuthService } from "./qonto-auth.service.js";
import { QontoConfigService } from "./qonto-config.service.js";
import { QontoController } from "./qonto.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [QontoController],
  providers: [QontoConfigService, QontoAuthService, QontoApiClient],
  exports: [QontoConfigService, QontoAuthService, QontoApiClient],
})
export class QontoModule {}
