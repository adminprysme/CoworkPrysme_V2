import type { Connection, Model, Schema } from "mongoose";

function readEnumValues(path: unknown): string[] | undefined {
  const enumValues = (path as { enumValues?: unknown[] } | undefined)?.enumValues;
  if (!Array.isArray(enumValues)) {
    return undefined;
  }
  return enumValues.filter((value): value is string => typeof value === "string");
}

function schemaNeedsReRegister(existing: Schema, next: Schema): boolean {
  for (const pathName of Object.keys(next.paths)) {
    if (!existing.paths[pathName]) {
      return true;
    }
  }

  const nextEnums = readEnumValues(next.path("status"));
  const currentEnums = readEnumValues(existing.path("status"));
  if (nextEnums && currentEnums) {
    const nextKey = [...nextEnums].sort().join(",");
    const currentKey = [...currentEnums].sort().join(",");
    if (nextKey !== currentKey) {
      return true;
    }
  }

  return false;
}

/** Idempotent model registration on a specific connection (never the global mongoose instance). */
export function registerModel<T>(
  connection: Connection,
  name: string,
  schema: Schema<T>,
): Model<T> {
  const existing = connection.models[name] as Model<T> | undefined;
  if (existing && schemaNeedsReRegister(existing.schema, schema)) {
    connection.deleteModel(name);
  }

  return (connection.models[name] as Model<T> | undefined) ?? connection.model<T>(name, schema);
}
