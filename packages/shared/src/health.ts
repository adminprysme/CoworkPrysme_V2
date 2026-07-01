import { z } from "zod";

export const HealthStatusSchema = z.enum(["ok", "degraded", "error"]);

/** Public frontend liveness — no database access. */
export const LivenessResponseSchema = z.object({
  status: z.literal("ok"),
});

/** Sanitized readiness for gestion-api (cowork + prysma). */
export const ReadinessResponseSchema = z.object({
  status: HealthStatusSchema,
  timestamp: z.string().datetime(),
  checks: z.object({
    cowork: z.boolean(),
    prysma: z.boolean(),
  }),
});

/** Sanitized readiness for vitrine-api (cowork only). */
export const CoworkReadinessResponseSchema = z.object({
  status: HealthStatusSchema,
  timestamp: z.string().datetime(),
  checks: z.object({
    cowork: z.boolean(),
  }),
});

/** Internal diagnostics — not exposed via public HTTP responses. */
export const DatabaseCheckSchema = z.object({
  connected: z.boolean(),
  latencyMs: z.number().nonnegative().optional(),
  error: z.string().optional(),
});

export const HealthCheckResponseSchema = z.object({
  status: HealthStatusSchema,
  timestamp: z.string().datetime(),
  cowork_bdd: DatabaseCheckSchema,
  prysma_bdd: DatabaseCheckSchema,
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export type LivenessResponse = z.infer<typeof LivenessResponseSchema>;
export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;
export type CoworkReadinessResponse = z.infer<typeof CoworkReadinessResponseSchema>;
export type DatabaseCheck = z.infer<typeof DatabaseCheckSchema>;
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
