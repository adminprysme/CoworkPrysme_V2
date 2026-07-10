import { z } from "zod";

import { durationClassLabel } from "./catalog-content.js";
import { SpaceTypeSchema } from "./spaces.js";

export const BOOKING_ERROR_CODES = {
  SLOT_UNAVAILABLE: "SLOT_UNAVAILABLE",
  SLOT_LOCK_CONFLICT: "SLOT_LOCK_CONFLICT",
  SPACE_NOT_FOUND: "SPACE_NOT_FOUND",
  LOCK_NOT_FOUND: "LOCK_NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

export type BookingErrorCode = (typeof BOOKING_ERROR_CODES)[keyof typeof BOOKING_ERROR_CODES];

export const BOOKING_PHASE1_DURATION_CLASSES = ["hourly", "daily"] as const;

export const BookingPhase1DurationClassSchema = z.enum(BOOKING_PHASE1_DURATION_CLASSES);

export type BookingPhase1DurationClass = z.infer<typeof BookingPhase1DurationClassSchema>;

export const isoDateTimeSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Invalid datetime",
  });

export const BOOKING_FLEXIBILITY_DAY_OPTIONS = [1, 2, 3, 7, 14] as const;

export const BookingFlexibilityDaysSchema = z.coerce
  .number()
  .int()
  .refine(
    (value) =>
      BOOKING_FLEXIBILITY_DAY_OPTIONS.includes(
        value as (typeof BOOKING_FLEXIBILITY_DAY_OPTIONS)[number],
      ),
    { message: "Invalid flexibilityDays" },
  );

export type BookingFlexibilityDays = (typeof BOOKING_FLEXIBILITY_DAY_OPTIONS)[number];

export const BookingTimeWindowSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

export type BookingTimeWindow = z.infer<typeof BookingTimeWindowSchema>;

export const BookingAvailabilityQuerySchema = z
  .object({
    spaceType: SpaceTypeSchema,
    startAt: isoDateTimeSchema,
    endAt: isoDateTimeSchema,
    partySize: z.coerce.number().int().min(1),
    buildingId: z.string().trim().min(1).optional(),
    floor: z.string().trim().min(1).optional(),
    flexibilityDays: BookingFlexibilityDaysSchema.optional(),
  })
  .superRefine((value, context) => {
    const startAt = new Date(value.startAt);
    const endAt = new Date(value.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date range" });
      return;
    }
    if (endAt <= startAt) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "endAt must be after startAt" });
    }
  });

export const BookingSpacesQuerySchema = z.object({
  spaceType: SpaceTypeSchema,
  partySize: z.coerce.number().int().min(1),
  buildingId: z.string().trim().min(1).optional(),
  floor: z.string().trim().min(1).optional(),
});

export const BookingSpaceAvailabilityQuerySchema = z
  .object({
    rangeStart: isoDateTimeSchema,
    rangeEnd: isoDateTimeSchema,
  })
  .superRefine((value, context) => {
    const rangeStart = new Date(value.rangeStart);
    const rangeEnd = new Date(value.rangeEnd);
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date range" });
      return;
    }
    if (rangeEnd <= rangeStart) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rangeEnd must be after rangeStart",
      });
    }
  });

export const BookingSpaceCardSchema = z.object({
  spaceId: z.string(),
  slug: z.string(),
  name: z.string(),
  buildingId: z.string(),
  buildingName: z.string(),
  city: z.string(),
  floor: z.union([z.string(), z.number()]).nullable(),
  capacity: z.number().int().min(1),
  spaceType: SpaceTypeSchema,
  equipments: z.array(z.string()),
  primaryPhotoUrl: z.string().url().nullable(),
  priceFromHTCents: z.number().int().min(0).nullable(),
  priceFromLabel: z.string().nullable(),
});

export const BookingAvailabilityResultSpaceSchema = BookingSpaceCardSchema.extend({
  availableWindows: z.array(BookingTimeWindowSchema).optional(),
});

export const BookingAvailabilityResponseSchema = z.object({
  spaces: z.array(BookingAvailabilityResultSpaceSchema),
});

export const BookingSpacesResponseSchema = z.object({
  spaces: z.array(BookingSpaceCardSchema),
});

export const BookingSlotSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  durationClass: BookingPhase1DurationClassSchema,
  selectable: z.boolean(),
});

export const BookingSpaceAvailabilityResponseSchema = z.object({
  spaceId: z.string(),
  spaceName: z.string(),
  slots: z.array(BookingSlotSchema),
});

export const CreateBookingLockRequestSchema = z
  .object({
    spaceId: z.string().trim().min(1),
    startAt: isoDateTimeSchema,
    endAt: isoDateTimeSchema,
    sessionId: z.string().trim().min(8).max(128),
    partySize: z.coerce.number().int().min(1).optional(),
  })
  .superRefine((value, context) => {
    const startAt = new Date(value.startAt);
    const endAt = new Date(value.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date range" });
      return;
    }
    if (endAt <= startAt) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "endAt must be after startAt" });
    }
  });

export const BookingLockResponseSchema = z.object({
  lockId: z.string(),
  expiresAt: z.string().datetime(),
  spaceId: z.string(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

export const ReleaseBookingLockQuerySchema = z.object({
  sessionId: z.string().trim().min(8).max(128),
});

export const BookingErrorResponseSchema = z.object({
  code: z.enum([
    BOOKING_ERROR_CODES.SLOT_UNAVAILABLE,
    BOOKING_ERROR_CODES.SLOT_LOCK_CONFLICT,
    BOOKING_ERROR_CODES.SPACE_NOT_FOUND,
    BOOKING_ERROR_CODES.LOCK_NOT_FOUND,
    BOOKING_ERROR_CODES.VALIDATION_ERROR,
  ]),
  message: z.string(),
});

export type BookingAvailabilityQuery = z.infer<typeof BookingAvailabilityQuerySchema>;
export type BookingSpacesQuery = z.infer<typeof BookingSpacesQuerySchema>;
export type BookingSpaceAvailabilityQuery = z.infer<typeof BookingSpaceAvailabilityQuerySchema>;
export type BookingSpaceCard = z.infer<typeof BookingSpaceCardSchema>;
export type BookingAvailabilityResultSpace = z.infer<typeof BookingAvailabilityResultSpaceSchema>;
export type BookingAvailabilityResponse = z.infer<typeof BookingAvailabilityResponseSchema>;
export type BookingSpacesResponse = z.infer<typeof BookingSpacesResponseSchema>;
export type BookingSlot = z.infer<typeof BookingSlotSchema>;
export type BookingSpaceAvailabilityResponse = z.infer<
  typeof BookingSpaceAvailabilityResponseSchema
>;
export type CreateBookingLockRequest = z.infer<typeof CreateBookingLockRequestSchema>;
export type BookingLockResponse = z.infer<typeof BookingLockResponseSchema>;

export { durationClassLabel as bookingDurationClassLabel };
