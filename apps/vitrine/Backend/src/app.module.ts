import { Module } from "@nestjs/common";

import { DbModule } from "./db/db.module.js";
import { GestionModule } from "./gestion/gestion.module.js";
import { HealthModule } from "./health/health.module.js";
import { HomeContentModule } from "./home-content/home-content.module.js";
import { MediaModule } from "./media/media.module.js";
import { ServicesContentModule } from "./services-content/services-content.module.js";
import { SiteContactModule } from "./site-contact/site-contact.module.js";

@Module({
  imports: [
    DbModule,
    HealthModule,
    GestionModule,
    MediaModule,
    HomeContentModule,
    ServicesContentModule,
    SiteContactModule,
  ],
})
export class AppModule {}
