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

export const BookingAvailabilityQuerySchema = z
  .object({
    spaceType: SpaceTypeSchema,
    startAt: isoDateTimeSchema,
    endAt: isoDateTimeSchema,
    partySize: z.coerce.number().int().min(1),
    buildingId: z.string().trim().min(1).optional(),
    floor: z.string().trim().min(1).optional(),
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

export const BookingAvailabilityResponseSchema = z.object({
  spaces: z.array(BookingSpaceCardSchema),
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
export type BookingAvailabilityResponse = z.infer<typeof BookingAvailabilityResponseSchema>;
export type BookingSpacesResponse = z.infer<typeof BookingSpacesResponseSchema>;
export type BookingSlot = z.infer<typeof BookingSlotSchema>;
export type BookingSpaceAvailabilityResponse = z.infer<
  typeof BookingSpaceAvailabilityResponseSchema
>;
export type CreateBookingLockRequest = z.infer<typeof CreateBookingLockRequestSchema>;
export type BookingLockResponse = z.infer<typeof BookingLockResponseSchema>;

export const BOOKING_PRICE_LINE_KINDS = ["space", "service", "discount"] as const;
export const BookingPriceLineKindSchema = z.enum(BOOKING_PRICE_LINE_KINDS);
export type BookingPriceLineKind = z.infer<typeof BookingPriceLineKindSchema>;

export const BookingServicesQuerySchema = z.object({
  buildingId: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{24}$/i, "Identifiant de bâtiment invalide"),
});

export const BookingServiceCatalogItemSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
  description: z.string().optional(),
  priceHTCents: z.number().int().min(0),
  vatRate: z.number().min(0),
  promoEligible: z.boolean(),
  customQuestions: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      type: z.string(),
      required: z.boolean(),
      order: z.number().int().min(0),
      options: z.array(z.string()).optional(),
    }),
  ),
  photo: z
    .object({
      storageKey: z.string(),
      url: z.string(),
      alt: z.string().optional(),
    })
    .optional(),
});

export const BookingServicesResponseSchema = z.object({
  services: z.array(BookingServiceCatalogItemSchema),
});

export const BookingPriceServiceInputSchema = z.object({
  serviceId: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{24}$/i, "Identifiant de service invalide"),
  qty: z.number().int().min(1),
  customAnswers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        type: z.string(),
        label: z.string().trim().min(1),
        value: z.unknown(),
      }),
    )
    .optional(),
});

export const BookingPriceRequestSchema = z
  .object({
    spaceId: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{24}$/i, "Identifiant d'espace invalide"),
    startAt: isoDateTimeSchema,
    endAt: isoDateTimeSchema,
    durationClass: BookingPhase1DurationClassSchema,
    services: z.array(BookingPriceServiceInputSchema).default([]),
    discountCode: z.string().trim().min(1).optional(),
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

export const BookingVatBreakdownLineSchema = z.object({
  rate: z.number(),
  baseHT: z.number().int(),
  vat: z.number().int(),
});

export const BookingPriceLineSchema = z.object({
  label: z.string(),
  kind: BookingPriceLineKindSchema,
  refId: z.string().optional(),
  qty: z.number().int().min(0),
  unitPriceHT: z.number().int().min(0),
  vatRate: z.number().min(0),
  discount: z.number().int().min(0),
  totalHT: z.number().int(),
  totalVAT: z.number().int(),
  totalTTC: z.number().int(),
});

export const BookingPriceDiscountSchema = z.object({
  code: z.string(),
  label: z.string(),
  type: z.enum(["percentage", "fixed_amount", "buy_one_get_one"]),
});

export const BookingPriceResponseSchema = z.object({
  subtotalHT: z.number().int().min(0),
  discountTotal: z.number().int().min(0),
  vatBreakdown: z.array(BookingVatBreakdownLineSchema),
  totalTTC: z.number().int().min(0),
  lines: z.array(BookingPriceLineSchema),
  discount: BookingPriceDiscountSchema.optional(),
});

export type BookingServicesQuery = z.infer<typeof BookingServicesQuerySchema>;
export type BookingServiceCatalogItem = z.infer<typeof BookingServiceCatalogItemSchema>;
export type BookingServicesResponse = z.infer<typeof BookingServicesResponseSchema>;
export type BookingPriceServiceInput = z.infer<typeof BookingPriceServiceInputSchema>;
export type BookingPriceRequest = z.infer<typeof BookingPriceRequestSchema>;
export type BookingVatBreakdownLine = z.infer<typeof BookingVatBreakdownLineSchema>;
export type BookingPriceLine = z.infer<typeof BookingPriceLineSchema>;
export type BookingPriceDiscount = z.infer<typeof BookingPriceDiscountSchema>;
export type BookingPriceResponse = z.infer<typeof BookingPriceResponseSchema>;

export { durationClassLabel as bookingDurationClassLabel };
