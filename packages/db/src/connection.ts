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

/**
 * Returns a singleton Mongoose instance connected to the MongoDB cluster.
 * Safe for Next.js serverless: reuses the cached connection across invocations.
 */
export async function connectMongo(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(getMongoUri(), {
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

/**
 * Returns a handle to the applicative database (read/write).
 */
export async function getCoworkDb() {
  const instance = await connectMongo();
  return instance.connection.useDb(getCoworkDbName(), { useCache: true });
}

/**
 * Returns a handle to the external SSO database (read-only by convention).
 * No write operations should be performed on this database without explicit approval.
 */
export async function getPrysmaDb() {
  const instance = await connectMongo();
  return instance.connection.useDb(getPrysmaDbName(), { useCache: true });
}
