import type { Connection, Model, Schema } from "mongoose";

/** Idempotent model registration on a specific connection (never the global mongoose instance). */
export function registerModel<T>(
  connection: Connection,
  name: string,
  schema: Schema<T>,
): Model<T> {
  return (connection.models[name] as Model<T> | undefined) ?? connection.model<T>(name, schema);
}
