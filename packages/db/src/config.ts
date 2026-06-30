const DEFAULT_COWORK_DB = "cowork_bdd";
const DEFAULT_PRYSMA_DB = "prysma_bdd";

export function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not defined");
  }
  return uri;
}

export function getCoworkDbName(): string {
  return process.env.MONGODB_DB_COWORK ?? DEFAULT_COWORK_DB;
}

export function getPrysmaDbName(): string {
  return process.env.MONGODB_DB_PRYSMA ?? DEFAULT_PRYSMA_DB;
}
