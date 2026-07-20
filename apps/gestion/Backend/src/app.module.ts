import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AuthModule } from "./auth/auth.module.js";
import { BillingModule } from "./billing/billing.module.js";
import { BuildingsModule } from "./buildings/buildings.module.js";
import { DbModule } from "./db/db.module.js";
import { DiscountCodesModule } from "./discount-codes/discount-codes.module.js";
import { HealthModule } from "./health/health.module.js";
import { PermissionsModule } from "./permissions/permissions.module.js";
import { PlanningModule } from "./planning/planning.module.js";
import { QontoModule } from "./qonto/qonto.module.js";
import { ServicesModule } from "./services/services.module.js";
import { SpacesModule } from "./spaces/spaces.module.js";
import { UploadsModule } from "./uploads/uploads.module.js";
import { VitrineContentModule } from "./vitrine-content/vitrine-content.module.js";

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    DbModule,
    HealthModule,
    AuthModule,
    PermissionsModule,
    UploadsModule,
    BuildingsModule,
    SpacesModule,
    ServicesModule,
    DiscountCodesModule,
    BillingModule,
    PlanningModule,
    QontoModule,
    VitrineContentModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
