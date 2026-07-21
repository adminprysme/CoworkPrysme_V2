import "reflect-metadata";

import cookieParser from "cookie-parser";
import { NestFactory } from "@nestjs/core";
import { initGestionApiEnv } from "@coworkprysme/shared/server";

import { AppModule } from "./app.module.js";
import { configureCors, getListenHost, getPort } from "./bootstrap.js";

async function bootstrap(): Promise<void> {
  const env = initGestionApiEnv();
  // rawBody required for Stripe webhook signature verification (POST /stripe/webhook).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(cookieParser());
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
