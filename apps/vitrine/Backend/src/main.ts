import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { initVitrineApiEnv } from "@coworkprysme/shared/server";

import { AppModule } from "./app.module.js";
import { configureCors, getListenHost, getPort } from "./bootstrap.js";
import { ZodValidationExceptionFilter } from "./common/zod-validation.exception-filter.js";

async function bootstrap() {
  const env = initVitrineApiEnv();
  // rawBody required for Stripe webhook signature verification (POST /stripe/webhook).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.useGlobalFilters(new ZodValidationExceptionFilter());
  configureCors(app, env.ALLOWED_ORIGIN);
  const port = getPort();
  const host = getListenHost();
  if (host) {
    await app.listen(port, host);
  } else {
    await app.listen(port);
  }
}

void bootstrap();
