import { parseServerEnv, type ServerEnv } from "@coworkprysme/shared";

let cachedEnv: ServerEnv | null = null;

function getEnv(): ServerEnv {
  cachedEnv ??= parseServerEnv();
  return cachedEnv;
}

export function getMongoUri(): string {
  return getEnv().MONGODB_URI;
}

export function getCoworkDbName(): string {
  return getEnv().MONGODB_DB_COWORK;
}

export function getPrysmaDbName(): string {
  return getEnv().MONGODB_DB_PRYSMA;
}

/** Resets cached config — for tests only. */
export function resetConfigCache(): void {
  cachedEnv = null;
}
