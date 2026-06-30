import mongoose from "mongoose";

import { getCoworkDbName, getMongoUri, getPrysmaDbName } from "./config.js";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cached;

const CONNECTION_OPTIONS = {
  bufferCommands: false,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  maxPoolSize: 10,
} as const;

/**
 * Returns a singleton Mongoose instance connected to the MongoDB cluster.
 * Safe for Next.js serverless: reuses the cached connection across invocations.
 */
export async function connectMongo(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(getMongoUri(), CONNECTION_OPTIONS)
      .then((instance) => {
        cached.conn = instance;
        return instance;
      })
      .catch((error: unknown) => {
        cached.promise = null;
        throw error;
      });
  }

  return cached.promise;
}

/**
 * Returns a handle to the applicative database (read/write).
 */
export async function getCoworkDb() {
  const instance = await connectMongo();
  return instance.connection.useDb(getCoworkDbName(), { useCache: true });
}

/**
 * Internal read-only handle for prysma — exported for in-package use only, not via package index.
 */
export async function getPrysmaDb() {
  const instance = await connectMongo();
  return instance.connection.useDb(getPrysmaDbName(), { useCache: true });
}

/** Resets connection cache — for tests only. */
export function resetMongoCache(): void {
  cached.conn = null;
  cached.promise = null;
  global._mongooseCache = cached;
}
