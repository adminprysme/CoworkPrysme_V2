import { Module } from "@nestjs/common";

import { DbModule } from "./db/db.module.js";
import { GestionModule } from "./gestion/gestion.module.js";
import { HealthModule } from "./health/health.module.js";
import { MediaModule } from "./media/media.module.js";

@Module({
  imports: [DbModule, HealthModule, GestionModule, MediaModule],
})
export class AppModule {}
