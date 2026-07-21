import { z } from "zod";

import { ServiceCustomAnswerSchema } from "./service-custom-questions.js";
import { SpaceDurationClassSchema } from "./spaces.js";

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
  /**
   * Latest refund lifecycle for staff UI (pending until Stripe webhook confirms).
   */
  refundStatus: z.enum(["none", "pending", "succeeded", "failed", "manual_succeeded"]).optional(),
  stripeRefundId: z.string().optional(),
  /**
   * Latest client email delivery failure (audit emailSent: false).
   * Omitted when the most recent email attempt succeeded or none was recorded.
   */
  emailDeliveryWarning: z
    .object({
      at: z.string().datetime(),
      error: z.string().optional(),
    })
    .optional(),
  readOnly: z.boolean(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  partySize: z.number().int().positive(),
  durationClass: SpaceDurationClassSchema,
  space: z.object({
    id: z.string(),
    name: z.string(),
    type: PlanningSpaceTypeSchema,
    buildingId: z.string(),
    buildingName: z.string(),
    capacity: z.number().int().positive().optional(),
  }),
  clientAccountId: z.string().optional(),
  cardexId: z.string().optional(),
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
  /**
   * Chosen / recorded payment channel for staff UI (card vs bank transfer).
   * Prefer latest matched Payment.method; fall back to awaitingPaymentMethod.
   */
  paymentMethod: z.enum(["card", "bank_transfer"]).optional(),
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
  "date_change",
  "party_size_change",
  "contact_transfer",
  "refund",
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

export const PlanningRefundExecutionSchema = z.enum(["stripe_card", "manual_transfer", "none"]);
export type PlanningRefundExecution = z.infer<typeof PlanningRefundExecutionSchema>;

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
  /** How a positive refund must be executed for this reservation. */
  refundExecution: PlanningRefundExecutionSchema,
  cardPaidCents: z.number().int().nonnegative(),
  cardRefundedCents: z.number().int().nonnegative(),
  /** Net Stripe ceiling: cardPaid − succeeded Stripe refunds. */
  stripeRefundableCents: z.number().int().nonnegative(),
  transferPaidCents: z.number().int().nonnegative(),
  transferRefundedCents: z.number().int().nonnegative(),
  transferRefundableCents: z.number().int().nonnegative(),
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
    /**
     * Transfer-only: when true, apply the manual off-Stripe refund immediately
     * at cancel time (staff confirms the outbound wire already happened).
     */
    markManualRefundNow: z.boolean().optional(),
    /** Required when markManualRefundNow is true (min 3 chars). */
    manualRefundNote: z.string().trim().min(3).max(2000).optional(),
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
    if (value.markManualRefundNow) {
      if (!value.manualRefundNote || value.manualRefundNote.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["manualRefundNote"],
          message: "Une note est obligatoire pour marquer le remboursement manuel",
        });
      }
      if (value.acceptedRefundCents <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["acceptedRefundCents"],
          message: "Un montant positif est requis pour un remboursement manuel",
        });
      }
    }
  });
export type PlanningCancelRequest = z.infer<typeof PlanningCancelRequestSchema>;

export const PlanningCancelResultSchema = z.object({
  reservation: PlanningReservationDetailSchema,
  suggestedRefundCents: z.number().int().nonnegative(),
  acceptedRefundCents: z.number().int().nonnegative(),
  basis: z.enum(["not_started", "in_progress", "ended", "unpaid"]),
  refundExecution: PlanningRefundExecutionSchema,
  refundStatus: z.enum(["none", "pending", "succeeded", "failed", "manual_succeeded"]).optional(),
  stripeRefundId: z.string().optional(),
});
export type PlanningCancelResult = z.infer<typeof PlanningCancelResultSchema>;

export const PlanningManualRefundRequestSchema = z.object({
  amountCents: z.number().int().positive(),
  note: z.string().trim().min(3).max(2000),
  confirm: z.literal(true),
});
export type PlanningManualRefundRequest = z.infer<typeof PlanningManualRefundRequestSchema>;

export const PlanningManualRefundResultSchema = z.object({
  reservationId: z.string(),
  amountCents: z.number().int().positive(),
  refundStatus: z.literal("manual_succeeded"),
  paymentId: z.string(),
});
export type PlanningManualRefundResult = z.infer<typeof PlanningManualRefundResultSchema>;

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

export const PlanningDateChangeKindSchema = z.enum(["extend", "shorten", "shift"]);
export type PlanningDateChangeKind = z.infer<typeof PlanningDateChangeKindSchema>;

export const PlanningShortenRefundBasisSchema = z.enum([
  "cgv_scale",
  "prorata_removed",
  "ended",
  "unpaid",
]);
export type PlanningShortenRefundBasis = z.infer<typeof PlanningShortenRefundBasisSchema>;

/**
 * Preview for a date/duration change (extend / shorten / shift).
 * Amounts are integer centimes, recalculated server-side from the space
 * tariff for `durationClass` — never trusted from the client.
 */
export const PlanningDateChangePreviewSchema = z.object({
  reservationId: z.string(),
  kind: PlanningDateChangeKindSchema,
  previousStartAt: z.string().datetime(),
  previousEndAt: z.string().datetime(),
  nextStartAt: z.string().datetime(),
  nextEndAt: z.string().datetime(),
  available: z.boolean(),
  conflictMessage: z.string().optional(),
  conflictingReservation: PlanningRestoreConflictSchema.nullable(),
  /** True when fewer than 48h remain before the ORIGINAL start. */
  within48h: z.boolean(),
  previousDurationClass: SpaceDurationClassSchema,
  nextDurationClass: SpaceDurationClassSchema,
  previousUnits: z.number().int().nonnegative(),
  nextUnits: z.number().int().nonnegative(),
  /** Unit price HT of the tariff tier selected for the NEW stay. */
  unitPriceHT: z.number().int().nonnegative(),
  vatRate: z.number().nonnegative(),
  previousSpaceTTC: z.number().int().nonnegative(),
  nextSpaceTTC: z.number().int().nonnegative(),
  /** Positive amount to bill (extend / shift-up), 0 otherwise. */
  complementTTC: z.number().int().nonnegative(),
  /** Suggested refund (shorten only, never auto-applied), 0 otherwise. */
  suggestedRefundCents: z.number().int().nonnegative(),
  refundBasis: PlanningShortenRefundBasisSchema.optional(),
  paidTotalCents: z.number().int().nonnegative(),
  /** Whether the complement would be billed to the proforma by default. */
  billable: z.boolean(),
});
export type PlanningDateChangePreview = z.infer<typeof PlanningDateChangePreviewSchema>;

export const PlanningDateChangeRequestSchema = z
  .object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    /** Explicit staff confirmation — required (true) when within48h. */
    confirmLateChange: z.boolean(),
    lateChangeReason: z.string().trim().min(3).max(2000).optional(),
    /** For extend/shift-up: bill the complement to the proforma now (default true). */
    billDifference: z.boolean(),
    /**
     * Required server-side when complementTTC > 0 and billDifference is false
     * (commercial gesture — traced to cardex audit).
     */
    skipBillingReason: z.string().trim().min(3).max(2000).optional(),
    acknowledgePriceGap: z.boolean(),
    /** For shorten: refund mode, mirroring the cancel flow (never auto-applied). */
    refundMode: PlanningCancelRefundModeSchema.optional(),
    acceptedRefundCents: z.number().int().nonnegative().optional(),
    refundDeviationReason: z.string().trim().min(3).max(2000).optional(),
    confirm: z.literal(true),
  })
  .superRefine((value, ctx) => {
    if (
      value.confirmLateChange &&
      (!value.lateChangeReason || value.lateChangeReason.trim().length < 3)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lateChangeReason"],
        message: "Un motif est obligatoire pour une modification à moins de 48h de l'arrivée",
      });
    }
    if (value.refundMode && value.refundMode !== "suggested" && !value.refundDeviationReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["refundDeviationReason"],
        message: "Une justification est obligatoire lorsque le montant diffère du suggéré",
      });
    }
  });
export type PlanningDateChangeRequest = z.infer<typeof PlanningDateChangeRequestSchema>;

export const PlanningDateChangeResultSchema = z.object({
  reservation: PlanningReservationDetailSchema,
  kind: PlanningDateChangeKindSchema,
  complementTTC: z.number().int().nonnegative(),
  billedDifference: z.boolean(),
  suggestedRefundCents: z.number().int().nonnegative(),
  acceptedRefundCents: z.number().int().nonnegative().optional(),
});
export type PlanningDateChangeResult = z.infer<typeof PlanningDateChangeResultSchema>;

export const PlanningPartySizePreviewSchema = z.object({
  reservationId: z.string(),
  currentPartySize: z.number().int().positive(),
  newPartySize: z.number().int().positive(),
  capacity: z.number().int().positive().optional(),
  exceedsCapacity: z.boolean(),
  suggestSpaceChange: z.boolean(),
});
export type PlanningPartySizePreview = z.infer<typeof PlanningPartySizePreviewSchema>;

export const PlanningPartySizeRequestSchema = z.object({
  newPartySize: z.number().int().positive(),
  note: z.string().trim().max(2000).optional(),
  confirm: z.literal(true),
});
export type PlanningPartySizeRequest = z.infer<typeof PlanningPartySizeRequestSchema>;

export const PlanningPartySizeResultSchema = z.object({
  reservation: PlanningReservationDetailSchema,
  previousPartySize: z.number().int().positive(),
  newPartySize: z.number().int().positive(),
});
export type PlanningPartySizeResult = z.infer<typeof PlanningPartySizeResultSchema>;

export const PlanningContactTransferPreviewSchema = z.object({
  reservationId: z.string(),
  currentContact: PlanningContactSchema.nullable(),
  /** Null when nextClientAccountId does not resolve to a contact on this reservation. */
  nextContact: PlanningContactSchema.nullable(),
  /** True when nextContact belongs to the same cardex/company contact set. */
  eligible: z.boolean(),
  reason: z.string().optional(),
});
export type PlanningContactTransferPreview = z.infer<typeof PlanningContactTransferPreviewSchema>;

export const PlanningContactTransferRequestSchema = z.object({
  nextClientAccountId: z.string().min(1),
  confirm: z.literal(true),
});
export type PlanningContactTransferRequest = z.infer<typeof PlanningContactTransferRequestSchema>;

export const PlanningContactTransferResultSchema = z.object({
  reservation: PlanningReservationDetailSchema,
  previousClientAccountId: z.string().optional(),
  nextClientAccountId: z.string(),
});
export type PlanningContactTransferResult = z.infer<typeof PlanningContactTransferResultSchema>;
