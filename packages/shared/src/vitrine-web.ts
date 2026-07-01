export {
  LivenessResponseSchema,
  ReadinessResponseSchema,
  CoworkReadinessResponseSchema,
  HealthStatusSchema,
  DatabaseCheckSchema,
  HealthCheckResponseSchema,
  type LivenessResponse,
  type ReadinessResponse,
  type CoworkReadinessResponse,
  type HealthStatus,
  type DatabaseCheck,
  type HealthCheckResponse,
} from "./health.js";

export {
  ServerEnvSchema,
  VitrineWebEnvSchema,
  GestionWebEnvSchema,
  parseServerEnv,
  parseVitrineWebEnv,
  parseGestionWebEnv,
  parseVitrineApiEnv,
  parseGestionApiEnv,
  resetServerEnvCache,
  GENERIC_ENV_ERROR,
  type ServerEnv,
  type VitrineWebEnv,
  type GestionWebEnv,
  type VitrineApiEnv,
  type GestionApiEnv,
} from "./env.js";

import { parseVitrineWebEnv } from "./env.js";

/** Validates vitrine-web env at server startup. */
export function initVitrineWebEnv(): ReturnType<typeof parseVitrineWebEnv> {
  return parseVitrineWebEnv();
}
