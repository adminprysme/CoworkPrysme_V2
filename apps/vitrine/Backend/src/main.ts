import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { initVitrineApiEnv } from "@coworkprysme/shared/server";

import { AppModule } from "./app.module.js";
import { configureCors, getPort } from "./bootstrap.js";

async function bootstrap(): Promise<void> {
  const env = initVitrineApiEnv();
  const app = await NestFactory.create(AppModule);
  configureCors(app, env.ALLOWED_ORIGIN);
  await app.listen(getPort());
}

void bootstrap();
