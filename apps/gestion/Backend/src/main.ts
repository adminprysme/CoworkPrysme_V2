import "reflect-metadata";

import cookieParser from "cookie-parser";
import { NestFactory } from "@nestjs/core";
import { initGestionApiEnv } from "@coworkprysme/shared/server";

import { AppModule } from "./app.module.js";
import { configureCors, getPort } from "./bootstrap.js";

async function bootstrap(): Promise<void> {
  const env = initGestionApiEnv();
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  configureCors(app, env.ALLOWED_ORIGIN);
  await app.listen(getPort());
}

void bootstrap();
