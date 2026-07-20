import { z } from "zod";

import { ServiceCustomAnswerSchema } from "./service-custom-questions.js";

export const PlanningViewModeSchema = z.enum(["month", "week", "day"]);
export type PlanningViewMode = z.infer<typeof PlanningViewModeSchema>;

export const PlanningPaymentStatusSchema = z.enum([
  "paid",
  "partially_paid",
  "awaiting_payment",
  "none",
]);
export type PlanningPaymentStatus = z.infer<typeof PlanningPaymentStatusSchema>;

export const PlanningSpaceTypeSchema = z.enum(["meeting_room", "private_office"]);
export type PlanningSpaceType = z.infer<typeof PlanningSpaceTypeSchema>;

export const PlanningReservationStatusSchema = z.enum([
  "pending",
  "awaiting_payment",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);
export type PlanningReservationStatus = z.infer<typeof PlanningReservationStatusSchema>;

export const PlanningBuildingOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type PlanningBuildingOption = z.infer<typeof PlanningBuildingOptionSchema>;

export const PlanningSpaceRowSchema = z.object({
  id: z.string(),
  buildingId: z.string(),
  buildingName: z.string(),
  name: z.string(),
  type: PlanningSpaceTypeSchema,
  floor: z.string().optional(),
  capacity: z.number().int().positive().optional(),
});
export type PlanningSpaceRow = z.infer<typeof PlanningSpaceRowSchema>;

export const PlanningCalendarReservationSchema = z.object({
  id: z.string(),
  reference: z.string(),
  spaceId: z.string(),
  buildingId: z.string(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  status: PlanningReservationStatusSchema,
  paymentStatus: PlanningPaymentStatusSchema,
  clientLabel: z.string(),
  clientFirstName: z.string().optional(),
  clientLastName: z.string().optional(),
  clientCompanyName: z.string().optional(),
  spaceName: z.string(),
  totalTTC: z.number().int().nonnegative(),
  invoiceReference: z.string().optional(),
});
export type PlanningCalendarReservation = z.infer<typeof PlanningCalendarReservationSchema>;

export const PlanningClosureBlockSchema = z.object({
  id: z.string(),
  kind: z.enum(["closed", "open_exception"]),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().optional(),
  spaceId: z.string().optional(),
  buildingId: z.string().optional(),
  spaceType: PlanningSpaceTypeSchema.optional(),
});
export type PlanningClosureBlock = z.infer<typeof PlanningClosureBlockSchema>;

export const PlanningCalendarResponseSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  buildings: z.array(PlanningBuildingOptionSchema),
  spaces: z.array(PlanningSpaceRowSchema),
  reservations: z.array(PlanningCalendarReservationSchema),
  closures: z.array(PlanningClosureBlockSchema),
});
export type PlanningCalendarResponse = z.infer<typeof PlanningCalendarResponseSchema>;

export const PlanningServiceLineSchema = z.object({
  serviceId: z.string(),
  label: z.string(),
  qty: z.number().int().positive(),
  unitPriceHT: z.number().int().nonnegative(),
  vatRate: z.number().nonnegative(),
  customAnswers: z.array(ServiceCustomAnswerSchema).optional(),
});
export type PlanningServiceLine = z.infer<typeof PlanningServiceLineSchema>;

export const PlanningContactSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type PlanningContact = z.infer<typeof PlanningContactSchema>;

export const PlanningReservationDetailSchema = z.object({
  id: z.string(),
  reference: z.string(),
  status: PlanningReservationStatusSchema,
  paymentStatus: PlanningPaymentStatusSchema,
  readOnly: z.boolean(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  space: z.object({
    id: z.string(),
    name: z.string(),
    type: PlanningSpaceTypeSchema,
    buildingId: z.string(),
    buildingName: z.string(),
  }),
  client: z.object({
    label: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    companyName: z.string().optional(),
    email: z.string().optional(),
  }),
  services: z.array(PlanningServiceLineSchema),
  pricing: z.object({
    /** Gross HT before discount — server snapshot from booking (space + services). */
    subtotalHT: z.number().int().nonnegative(),
    totalVAT: z.number().int().nonnegative(),
    totalTTC: z.number().int().nonnegative(),
    discountTotal: z.number().int().nonnegative(),
    /** Space line HT (qty × unitPriceHT) from booking snapshot / invoice. */
    spaceHT: z.number().int().nonnegative(),
    /** Sum of service lines HT (qty × unitPriceHT) from reservation snapshot. */
    servicesHT: z.number().int().nonnegative(),
  }),
  invoice: z
    .object({
      id: z.string(),
      reference: z.string(),
      status: z.string(),
      paidTotal: z.number().int().nonnegative(),
      balanceDue: z.number().int().nonnegative(),
    })
    .nullable(),
  awaitingPaymentMethod: z.enum(["card", "bank_transfer"]).optional(),
  awaitingPaymentExpiresAt: z.string().datetime().optional(),
  contacts: z.array(PlanningContactSchema),
  createdChannel: z.enum(["online", "staff", "phone"]),
});
export type PlanningReservationDetail = z.infer<typeof PlanningReservationDetailSchema>;

export const PlanningHistoryEventTypeSchema = z.enum([
  "reservation",
  "cancellation",
  "space_change",
  "restoration",
  "closure",
]);
export type PlanningHistoryEventType = z.infer<typeof PlanningHistoryEventTypeSchema>;

export const PlanningHistoryEventSchema = z.object({
  id: z.string(),
  type: PlanningHistoryEventTypeSchema,
  at: z.string().datetime(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  title: z.string(),
  detail: z.string().optional(),
  clientLabel: z.string().optional(),
  reservationId: z.string().optional(),
  reservationReference: z.string().optional(),
  reservationStatus: PlanningReservationStatusSchema.optional(),
  paymentStatus: PlanningPaymentStatusSchema.optional(),
});
export type PlanningHistoryEvent = z.infer<typeof PlanningHistoryEventSchema>;

export const PlanningSpaceHistoryResponseSchema = z.object({
  space: PlanningSpaceRowSchema,
  from: z.string().datetime(),
  to: z.string().datetime(),
  events: z.array(PlanningHistoryEventSchema),
});
export type PlanningSpaceHistoryResponse = z.infer<typeof PlanningSpaceHistoryResponseSchema>;

export const PlanningOccupancyMetricSchema = z.object({
  rate: z.number().int().min(0).max(100),
  occupiedSpaces: z.number().int().nonnegative(),
  totalActiveSpaces: z.number().int().nonnegative(),
  periodLabel: z.string().min(1),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
});
export type PlanningOccupancyMetric = z.infer<typeof PlanningOccupancyMetricSchema>;

export const PlanningOccupancyResponseSchema = z.object({
  computedAt: z.string().datetime(),
  totalActiveSpaces: z.number().int().nonnegative(),
  day: PlanningOccupancyMetricSchema,
  week: PlanningOccupancyMetricSchema,
  month: PlanningOccupancyMetricSchema,
});
export type PlanningOccupancyResponse = z.infer<typeof PlanningOccupancyResponseSchema>;

export const PlanningSearchHitSchema = z.object({
  reservationId: z.string(),
  reference: z.string(),
  clientLabel: z.string(),
  spaceName: z.string(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  paymentStatus: PlanningPaymentStatusSchema,
  invoiceReference: z.string().optional(),
});
export type PlanningSearchHit = z.infer<typeof PlanningSearchHitSchema>;

export const PlanningSearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(PlanningSearchHitSchema),
});
export type PlanningSearchResponse = z.infer<typeof PlanningSearchResponseSchema>;

export const PlanningManageSpaceOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: PlanningSpaceTypeSchema,
  buildingId: z.string(),
  buildingName: z.string(),
  floor: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  available: z.boolean(),
  unavailableReason: z.string().optional(),
});
export type PlanningManageSpaceOption = z.infer<typeof PlanningManageSpaceOptionSchema>;

export const PlanningSpaceChangePreviewSchema = z.object({
  reservationId: z.string(),
  currentSpace: z.object({
    id: z.string(),
    name: z.string(),
    type: PlanningSpaceTypeSchema,
  }),
  nextSpace: z.object({
    id: z.string(),
    name: z.string(),
    type: PlanningSpaceTypeSchema,
  }),
  available: z.boolean(),
  conflictMessage: z.string().optional(),
  previousPricing: z.object({
    subtotalHT: z.number().int().nonnegative(),
    totalVAT: z.number().int().nonnegative(),
    totalTTC: z.number().int().nonnegative(),
  }),
  nextPricing: z.object({
    subtotalHT: z.number().int().nonnegative(),
    totalVAT: z.number().int().nonnegative(),
    totalTTC: z.number().int().nonnegative(),
  }),
  deltaTTC: z.number().int(),
});
export type PlanningSpaceChangePreview = z.infer<typeof PlanningSpaceChangePreviewSchema>;

export const PlanningSpaceChangeRequestSchema = z.object({
  nextSpaceId: z.string().min(1),
  billDifference: z.boolean(),
  acknowledgePriceGap: z.boolean(),
});
export type PlanningSpaceChangeRequest = z.infer<typeof PlanningSpaceChangeRequestSchema>;

export const PlanningSpaceChangeResultSchema = z.object({
  reservation: PlanningReservationDetailSchema,
  billedDifference: z.boolean(),
  deltaTTC: z.number().int(),
});
export type PlanningSpaceChangeResult = z.infer<typeof PlanningSpaceChangeResultSchema>;

export const PlanningCancelPreviewSchema = z.object({
  reservationId: z.string(),
  reference: z.string(),
  status: PlanningReservationStatusSchema,
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  paidTotalCents: z.number().int().nonnegative(),
  suggestedRefundCents: z.number().int().nonnegative(),
  basis: z.enum(["not_started", "in_progress", "ended", "unpaid"]),
  totalDurationMs: z.number().int().nonnegative(),
  remainingMs: z.number().int().nonnegative(),
  elapsedMs: z.number().int().nonnegative(),
});
export type PlanningCancelPreview = z.infer<typeof PlanningCancelPreviewSchema>;

export const PlanningCancelRefundModeSchema = z.enum(["suggested", "custom", "none"]);
export type PlanningCancelRefundMode = z.infer<typeof PlanningCancelRefundModeSchema>;

export const PlanningCancelRequestSchema = z
  .object({
    reason: z.string().trim().min(3).max(2000),
    /** Staff acknowledgment of the chosen refund amount (suggested / custom / none). */
    confirmRefund: z.boolean(),
    refundMode: PlanningCancelRefundModeSchema,
    /**
     * Amount the staff accepts to refund, in integer cents.
     * - suggested: must equal server-recalculated suggestion
     * - custom: 0 ≤ amount ≤ paidTotal (validated server-side)
     * - none: must be 0
     */
    acceptedRefundCents: z.number().int().nonnegative(),
    /**
     * Mandatory when refundMode !== "suggested": justifies departing from the
     * automatic suggestion. Traced in audit alongside the cancel reason.
     */
    refundDeviationReason: z.string().trim().min(3).max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.refundMode !== "suggested" && !value.refundDeviationReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["refundDeviationReason"],
        message: "Une justification est obligatoire lorsque le montant diffère du suggéré",
      });
    }
    if (value.refundMode === "none" && value.acceptedRefundCents !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["acceptedRefundCents"],
        message: "Le mode « Ne pas rembourser » impose un montant à 0",
      });
    }
  });
export type PlanningCancelRequest = z.infer<typeof PlanningCancelRequestSchema>;

export const PlanningCancelResultSchema = z.object({
  reservation: PlanningReservationDetailSchema,
  suggestedRefundCents: z.number().int().nonnegative(),
  acceptedRefundCents: z.number().int().nonnegative(),
  basis: z.enum(["not_started", "in_progress", "ended", "unpaid"]),
});
export type PlanningCancelResult = z.infer<typeof PlanningCancelResultSchema>;

export const PlanningRestoreConflictSchema = z.object({
  id: z.string(),
  reference: z.string(),
  clientLabel: z.string(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});
export type PlanningRestoreConflict = z.infer<typeof PlanningRestoreConflictSchema>;

/**
 * Eligibility for restoring a cancelled reservation.
 * Restore is only offered when refundEligible && slotAvailable (canRestore).
 * If refundEligible is false, the Manage UI must hide the restore action entirely.
 */
export const PlanningRestorePreviewSchema = z.object({
  reservationId: z.string(),
  reference: z.string(),
  status: PlanningReservationStatusSchema,
  /** Both gates true — restore button may be shown and submitted. */
  canRestore: z.boolean(),
  /**
   * Cancel audit recorded acceptedRefundCents === 0.
   * False when a refund was applied or no cancel audit exists.
   */
  refundEligible: z.boolean(),
  /** Refund amount recorded on the last cancel audit (null if missing). */
  acceptedRefundCentsAtCancel: z.number().int().nonnegative().nullable(),
  slotAvailable: z.boolean(),
  conflictingReservation: PlanningRestoreConflictSchema.nullable(),
});
export type PlanningRestorePreview = z.infer<typeof PlanningRestorePreviewSchema>;

export const PlanningRestoreRequestSchema = z.object({
  /** Explicit staff confirmation — restore must not be a one-click action. */
  confirm: z.literal(true),
});
export type PlanningRestoreRequest = z.infer<typeof PlanningRestoreRequestSchema>;

export const PlanningRestoreResultSchema = z.object({
  reservation: PlanningReservationDetailSchema,
});
export type PlanningRestoreResult = z.infer<typeof PlanningRestoreResultSchema>;
