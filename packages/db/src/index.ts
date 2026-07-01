export { connectMongo, getCoworkDb, resetMongoCache } from "./connection.js";

export { getHealthCheckModel, type HealthCheckDocument } from "./models/health-check.js";

export { runReadinessCheck, runCoworkReadinessCheck } from "./health.js";

export * from "./lib/index.js";

export * from "./domains/structure/index.js";
export * from "./domains/reservation/index.js";
export * from "./domains/client/index.js";
export * from "./domains/staff/index.js";
export * from "./domains/pricing/index.js";
export * from "./domains/billing/index.js";
export * from "./domains/peripheral/index.js";

export {
  COWORK_COLLECTION_NAMES,
  registerAllCoworkModels,
} from "./domains/register-cowork-models.js";
