import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { loadInvoiceIssuerConfig } from "@coworkprysme/invoice-pdf";
import { initVitrineApiEnv } from "@coworkprysme/shared/server";

import { AppModule } from "./app.module.js";
import { configureCors, getListenHost, getPort } from "./bootstrap.js";
import { ZodValidationExceptionFilter } from "./common/zod-validation.exception-filter.js";

async function bootstrap() {
  const env = initVitrineApiEnv();
  const issuer = loadInvoiceIssuerConfig();
  if (!issuer) {
    new Logger("Bootstrap").error(
      "INVOICE_ISSUER_* incomplete — proforma PDF attachments will fail until required issuer env vars are set (LEGAL_NAME, LEGAL_FORM, SHARE_CAPITAL, ADDRESS_LINE1, SIRET, VAT_NUMBER, RCS). Prefer pnpm dev / scripts/run-with-env.mjs so values with spaces load correctly.",
    );
  } else {
    new Logger("Bootstrap").log(`Invoice issuer ready: ${issuer.legalName} (${issuer.siret})`);
  }
  // rawBody required for Stripe webhook signature verification (POST /stripe/webhook).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // One hop: Coolify reverse proxy — req.ip = client, not Docker proxy.
  app.set("trust proxy", 1);
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
