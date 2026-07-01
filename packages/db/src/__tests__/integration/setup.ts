import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import { resetConfigCache } from "../../config.js";
import { resetMongoCache } from "../../connection.js";

let replSet: MongoMemoryReplSet | undefined;

export async function startIntegrationMongo(): Promise<string> {
  if (process.env.MONGODB_TEST_URI) {
    return process.env.MONGODB_TEST_URI;
  }

  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await replSet.waitUntilRunning();
  return replSet.getUri();
}

export async function configureIntegrationEnv(uri: string): Promise<void> {
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB_COWORK = "cowork_bdd_test";
  process.env.MONGODB_DB_PRYSMA = "prysma_bdd_test";
  resetConfigCache();
  resetMongoCache();
}

export async function stopIntegrationMongo(): Promise<void> {
  await mongoose.disconnect();
  resetMongoCache();
  resetConfigCache();
  if (replSet) {
    await replSet.stop();
    replSet = undefined;
  }
}

export async function clearCoworkCollections(): Promise<void> {
  const db = mongoose.connection.useDb(process.env.MONGODB_DB_COWORK ?? "cowork_bdd_test", {
    useCache: true,
  });
  const database = db.db;
  if (!database) {
    return;
  }
  const collections = await database.listCollections().toArray();
  await Promise.all(
    collections.map((collection) =>
      database.dropCollection(collection.name).catch(() => undefined),
    ),
  );
}
