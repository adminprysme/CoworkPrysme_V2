export {
  ServerEnvSchema,
  parseServerEnv,
  parseVitrineApiEnv,
  parseGestionApiEnv,
  resetServerEnvCache,
  GENERIC_ENV_ERROR,
  type ServerEnv,
  type VitrineApiEnv,
  type GestionApiEnv,
} from "./env.js";

import { parseGestionApiEnv, parseServerEnv, parseVitrineApiEnv } from "./env.js";

/** Validates API server env at startup — used by legacy Next gestion app. */
export function initServerEnv(): ReturnType<typeof parseServerEnv> {
  return parseServerEnv();
}

export function initVitrineApiEnv(): ReturnType<typeof parseVitrineApiEnv> {
  return parseVitrineApiEnv();
}

export function initGestionApiEnv(): ReturnType<typeof parseGestionApiEnv> {
  return parseGestionApiEnv();
}
