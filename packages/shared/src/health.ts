import { z } from "zod";

export const HealthStatusSchema = z.enum(["ok", "degraded", "error"]);

export const DatabaseCheckSchema = z.object({
  connected: z.boolean(),
  latencyMs: z.number().nonnegative().optional(),
  error: z.string().optional(),
});

export const HealthCheckResponseSchema = z.object({
  status: HealthStatusSchema,
  timestamp: z.string().datetime(),
  cowork_bdd: DatabaseCheckSchema,
  prysma_bdd: DatabaseCheckSchema.extend({
    connected: z.boolean().describe("Whether prysma_bdd is reachable (read-only ping)"),
  }),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export type DatabaseCheck = z.infer<typeof DatabaseCheckSchema>;
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
