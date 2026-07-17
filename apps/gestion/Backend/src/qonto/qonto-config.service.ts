import { Injectable } from "@nestjs/common";
import type { GestionApiEnv } from "@coworkprysme/shared/server";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI */
import { AuthConfigService } from "../auth/auth-config.service.js";
import { resolveQontoEndpoints, type QontoEndpoints } from "./qonto-endpoints.js";

export interface QontoRuntimeConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: string;
  stagingToken: string | undefined;
  env: "sandbox" | "production";
  bankAccountId: string | undefined;
  pollIntervalMs: number;
  endpoints: QontoEndpoints;
}

@Injectable()
export class QontoConfigService {
  readonly config: QontoRuntimeConfig;

  constructor(authConfig: AuthConfigService) {
    this.config = buildQontoRuntimeConfig(authConfig.env);
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}

export function buildQontoRuntimeConfig(env: GestionApiEnv): QontoRuntimeConfig {
  const clientId = env.QONTO_CLIENT_ID?.trim();
  const clientSecret = env.QONTO_CLIENT_SECRET?.trim();
  const redirectUri = env.QONTO_REDIRECT_URI?.trim();
  const encryptionKey = env.QONTO_TOKEN_ENCRYPTION_KEY?.trim();
  const qontoEnv = env.QONTO_ENV ?? "sandbox";
  const stagingToken = env.QONTO_STAGING_TOKEN?.trim();

  const enabled = Boolean(clientId && clientSecret && redirectUri && encryptionKey);
  if (enabled && qontoEnv === "sandbox" && !stagingToken) {
    throw new Error("QONTO_STAGING_TOKEN is required when QONTO_ENV=sandbox");
  }

  return {
    enabled,
    clientId: clientId ?? "",
    clientSecret: clientSecret ?? "",
    redirectUri: redirectUri ?? "",
    encryptionKey: encryptionKey ?? "",
    stagingToken,
    env: qontoEnv,
    bankAccountId: env.QONTO_BANK_ACCOUNT_ID?.trim() || undefined,
    pollIntervalMs: env.QONTO_POLL_INTERVAL_MS ?? 600_000,
    endpoints: resolveQontoEndpoints(qontoEnv),
  };
}
