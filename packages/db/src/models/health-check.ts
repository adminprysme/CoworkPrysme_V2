import { Schema, type Connection, type Model } from "mongoose";

export interface HealthCheckDocument {
  checkedAt: Date;
  status: "ok";
}

const healthCheckSchema = new Schema<HealthCheckDocument>(
  {
    checkedAt: { type: Date, required: true, default: Date.now },
    status: { type: String, required: true, enum: ["ok"], default: "ok" },
  },
  {
    timestamps: true,
    collection: "health_checks",
  },
);

export type HealthCheckModel = Model<HealthCheckDocument>;

export function getHealthCheckModel(connection: Connection): HealthCheckModel {
  return (
    (connection.models.HealthCheck as HealthCheckModel | undefined) ??
    connection.model<HealthCheckDocument>("HealthCheck", healthCheckSchema)
  );
}
