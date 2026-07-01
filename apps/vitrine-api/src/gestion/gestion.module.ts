import { Module } from "@nestjs/common";

import { GestionClientService } from "./gestion-client.service.js";

@Module({
  providers: [GestionClientService],
  exports: [GestionClientService],
})
export class GestionModule {}
