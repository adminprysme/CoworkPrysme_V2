import type { DatabaseCheck, HealthCheckResponse, HealthStatus } from "@coworkprysme/shared";

import { getCoworkDb, getPrysmaDb } from "./connection.js";
import { getHealthCheckModel } from "./models/health-check.js";

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
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Read-only ping against the external prysma_bdd SSO database.
 * Does not create or modify any collection.
 */
async function pingPrysmaDb(): Promise<DatabaseCheck> {
  const start = Date.now();
  try {
    const db = await getPrysmaDb();
    if (!db.db) {
      throw new Error("Prysma database handle is unavailable");
    }
    await db.db.admin().ping();
    return { connected: true, latencyMs: Date.now() - start };
  } catch (error) {
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

export async function runHealthCheck(): Promise<HealthCheckResponse> {
  const [cowork_bdd, prysma_bdd] = await Promise.all([checkCoworkDb(), pingPrysmaDb()]);

  return {
    status: resolveStatus(cowork_bdd, prysma_bdd),
    timestamp: new Date().toISOString(),
    cowork_bdd,
    prysma_bdd,
  };
}
