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
  "closure",
]);
export type PlanningHistoryEventType = z.infer<typeof PlanningHistoryEventTypeSchema>;

export const PlanningHistoryEventSchema = z.object({
  id: z.string(),
  type: PlanningHistoryEventTypeSchema,
  at: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  title: z.string(),
  detail: z.string().optional(),
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
