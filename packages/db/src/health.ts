import type {
  CoworkReadinessResponse,
  DatabaseCheck,
  HealthStatus,
  ReadinessResponse,
} from "@coworkprysme/shared";

import { getCoworkDb, getPrysmaDb } from "./connection.js";
import { getHealthCheckModel } from "./models/health-check.js";

function logHealthError(scope: string, error: unknown): void {
  console.error(`[health:${scope}]`, error instanceof Error ? error.message : "Unknown error");
}

async function checkCoworkDb(): Promise<DatabaseCheck> {
  const start = Date.now();
  try {
    const db = await getCoworkDb();
    if (!db.db) {
      throw new Error("Cowork database handle is unavailable");
    }
    await db.db.admin().ping();

    const HealthCheck = getHealthCheckModel(db);
    await HealthCheck.findOne().lean().exec();

    return { connected: true, latencyMs: Date.now() - start };
  } catch (error) {
    logHealthError("cowork", error);
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Read-only ping against the external SSO database.
 * Does not create or modify any collection.
 */
export async function pingPrysmaDb(): Promise<DatabaseCheck> {
  const start = Date.now();
  try {
    const db = await getPrysmaDb();
    if (!db.db) {
      throw new Error("Prysma database handle is unavailable");
    }
    await db.db.admin().ping();
    return { connected: true, latencyMs: Date.now() - start };
  } catch (error) {
    logHealthError("prysma", error);
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function resolveStatus(cowork: DatabaseCheck, prysma: DatabaseCheck): HealthStatus {
  if (!cowork.connected || !prysma.connected) {
    return "error";
  }
  if (cowork.error ?? prysma.error) {
    return "degraded";
  }
  return "ok";
}

/** Sanitized readiness check for gestion-api — cowork + prysma, no internal error details. */
export async function runReadinessCheck(): Promise<ReadinessResponse> {
  const [cowork, prysma] = await Promise.all([checkCoworkDb(), pingPrysmaDb()]);

  return {
    status: resolveStatus(cowork, prysma),
    timestamp: new Date().toISOString(),
    checks: {
      cowork: cowork.connected,
      prysma: prysma.connected,
    },
  };
}

function resolveCoworkOnlyStatus(cowork: DatabaseCheck): HealthStatus {
  if (!cowork.connected) {
    return "error";
  }
  if (cowork.error) {
    return "degraded";
  }
  return "ok";
}

/** Sanitized readiness for vitrine-api — cowork only, never touches prysma_bdd. */
export async function runCoworkReadinessCheck(): Promise<CoworkReadinessResponse> {
  const cowork = await checkCoworkDb();

  return {
    status: resolveCoworkOnlyStatus(cowork),
    timestamp: new Date().toISOString(),
    checks: {
      cowork: cowork.connected,
    },
  };
}
