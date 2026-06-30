export {
  LivenessResponseSchema,
  ReadinessResponseSchema,
  HealthStatusSchema,
  DatabaseCheckSchema,
  HealthCheckResponseSchema,
  type LivenessResponse,
  type ReadinessResponse,
  type HealthStatus,
  type DatabaseCheck,
  type HealthCheckResponse,
} from "./health.js";

export {
  ServerEnvSchema,
  parseServerEnv,
  resetServerEnvCache,
  GENERIC_ENV_ERROR,
  type ServerEnv,
} from "./env.js";

import { parseServerEnv } from "./env.js";

/** Validates environment — call from Next.js instrumentation at server startup. */
export function initServerEnv(): ReturnType<typeof parseServerEnv> {
  return parseServerEnv();
}
