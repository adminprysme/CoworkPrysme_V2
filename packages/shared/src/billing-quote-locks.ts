import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Identifiant invalide");

const isoDateTimeSchema = z.string().datetime();

export const BILLING_QUOTE_LOCKS_ERROR_CODES = {
  SPACE_NOT_FOUND: "SPACE_NOT_FOUND",
  SLOT_UNAVAILABLE: "SLOT_UNAVAILABLE",
  SLOT_LOCK_CONFLICT: "SLOT_LOCK_CONFLICT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CAPACITY_EXCEEDED: "CAPACITY_EXCEEDED",
} as const;

export type BillingQuoteLocksErrorCode =
  (typeof BILLING_QUOTE_LOCKS_ERROR_CODES)[keyof typeof BILLING_QUOTE_LOCKS_ERROR_CODES];

export const StaffQuoteLockSlotSchema = z
  .object({
    spaceId: objectIdSchema,
    startAt: isoDateTimeSchema,
    endAt: isoDateTimeSchema,
    partySize: z.number().int().min(1).max(500).optional(),
  })
  .superRefine((value, context) => {
    const startAt = new Date(value.startAt);
    const endAt = new Date(value.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Plage de dates invalide" });
      return;
    }
    if (endAt <= startAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endAt doit être postérieur à startAt",
      });
    }
  });
export type StaffQuoteLockSlot = z.infer<typeof StaffQuoteLockSlotSchema>;

export const StaffQuoteAvailabilityCheckRequestSchema = z.object({
  slots: z.array(StaffQuoteLockSlotSchema).min(1).max(20),
  /** When set, locks owned by this staff wizard session are ignored in the check. */
  quoteDraftId: objectIdSchema.optional(),
});
export type StaffQuoteAvailabilityCheckRequest = z.infer<
  typeof StaffQuoteAvailabilityCheckRequestSchema
>;

export const StaffQuoteAvailabilitySlotResultSchema = z.object({
  spaceId: z.string(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  available: z.boolean(),
  reason: z.enum(["ok", "unavailable", "opening_hours", "capacity", "not_found"]).optional(),
});
export type StaffQuoteAvailabilitySlotResult = z.infer<
  typeof StaffQuoteAvailabilitySlotResultSchema
>;

export const StaffQuoteAvailabilityCheckResponseSchema = z.object({
  results: z.array(StaffQuoteAvailabilitySlotResultSchema),
});
export type StaffQuoteAvailabilityCheckResponse = z.infer<
  typeof StaffQuoteAvailabilityCheckResponseSchema
>;

export const StaffQuoteLocksAcquireRequestSchema = z.object({
  quoteDraftId: objectIdSchema,
  slots: z.array(StaffQuoteLockSlotSchema).min(1).max(20),
});
export type StaffQuoteLocksAcquireRequest = z.infer<typeof StaffQuoteLocksAcquireRequestSchema>;

export const StaffQuoteLockItemSchema = z.object({
  lockId: z.string(),
  spaceId: z.string(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});
export type StaffQuoteLockItem = z.infer<typeof StaffQuoteLockItemSchema>;

export const StaffQuoteLocksAcquireResponseSchema = z.object({
  sessionId: z.string(),
  locks: z.array(StaffQuoteLockItemSchema),
  expiresAt: z.string().datetime(),
  durationMs: z.number().int().positive(),
});
export type StaffQuoteLocksAcquireResponse = z.infer<typeof StaffQuoteLocksAcquireResponseSchema>;

export const StaffQuoteLocksSessionRequestSchema = z.object({
  quoteDraftId: objectIdSchema,
});
export type StaffQuoteLocksSessionRequest = z.infer<typeof StaffQuoteLocksSessionRequestSchema>;

export const StaffQuoteLocksRefreshResponseSchema = z.object({
  sessionId: z.string(),
  refreshed: z.number().int().min(0),
  expiresAt: z.string().datetime().nullable(),
  locks: z.array(StaffQuoteLockItemSchema),
  durationMs: z.number().int().positive(),
});
export type StaffQuoteLocksRefreshResponse = z.infer<typeof StaffQuoteLocksRefreshResponseSchema>;

export const StaffQuoteLocksReleaseResponseSchema = z.object({
  sessionId: z.string(),
  released: z.number().int().min(0),
});
export type StaffQuoteLocksReleaseResponse = z.infer<typeof StaffQuoteLocksReleaseResponseSchema>;
