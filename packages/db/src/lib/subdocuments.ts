import { Schema, type Types } from "mongoose";

import {
  BILLING_LINE_KINDS,
  CARDEX_DOCUMENT_CATEGORIES,
  DURATION_CLASSES,
  QUOTE_LINE_PRICE_SOURCES,
  WEEK_DAYS,
  type BillingLineKind,
  type CardexDocumentCategory,
  type DurationClass,
  type QuoteLinePriceSource,
  type WeekDay,
} from "./enums.js";
import { centsField, objectIdRef } from "./schema-helpers.js";

export const DEFAULT_SPACE_TARIFF_VAT_RATE = 20;
export const MAX_SPACE_TARIFFS = 5;

export interface Address {
  street: string;
  zip: string;
  city: string;
  country: string;
  accessInfo?: string;
}

export const addressSchema = new Schema<Address>(
  {
    street: { type: String, required: true },
    zip: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true, default: "FR" },
    accessInfo: { type: String },
  },
  { _id: false },
);

export interface SeoMeta {
  slug: string;
  metaTitle: string;
  metaDescription: string;
}

export const seoSchema = new Schema<SeoMeta>(
  {
    slug: { type: String, required: true },
    metaTitle: { type: String, required: true },
    metaDescription: { type: String, required: true },
  },
  { _id: false },
);

export interface Equipment {
  key: string;
  label: string;
}

export const equipmentSchema = new Schema<Equipment>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false },
);

/** Punctual price grid line embedded on a space (gestion). */
export interface SpaceTariff {
  durationClass: DurationClass;
  priceHT: number;
  vatRate: number;
  enabled: boolean;
}

export const spaceTariffSchema = new Schema<SpaceTariff>(
  {
    durationClass: { type: String, enum: DURATION_CLASSES, required: true },
    priceHT: centsField({ min: 0 }),
    vatRate: { type: Number, required: true, default: DEFAULT_SPACE_TARIFF_VAT_RATE, min: 0 },
    enabled: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

export interface Photo {
  storageKey: string;
  alt: string;
  order: number;
}

export const photoSchema = new Schema<Photo>(
  {
    storageKey: { type: String, required: true },
    alt: { type: String, required: true },
    order: { type: Number, required: true },
  },
  { _id: false },
);

/** Single optional photo on a catalog service (gestion / vitrine booking). */
export interface ServicePhoto {
  storageKey: string;
  alt?: string;
}

export const servicePhotoSchema = new Schema<ServicePhoto>(
  {
    storageKey: { type: String, required: true },
    alt: { type: String, trim: true },
  },
  { _id: false },
);

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface BuildingFloor {
  name: string;
}

export const buildingFloorSchema = new Schema<BuildingFloor>(
  {
    name: { type: String, required: true, trim: true },
  },
  { _id: false },
);

/** Weekly schedule entry for building access or reception hours. */
export interface BuildingDaySchedule {
  day: WeekDay;
  is24h: boolean;
  open: string;
  close: string;
}

export const buildingDayScheduleSchema = new Schema<BuildingDaySchedule>(
  {
    day: {
      type: String,
      required: true,
      enum: WEEK_DAYS,
    },
    is24h: { type: Boolean, required: true, default: false },
    open: {
      type: String,
      required: true,
      default: "00:00",
      validate: {
        validator: (value: string) => TIME_OF_DAY_PATTERN.test(value),
        message: "open must be a valid HH:mm time",
      },
    },
    close: {
      type: String,
      required: true,
      default: "00:00",
      validate: {
        validator: (value: string) => TIME_OF_DAY_PATTERN.test(value),
        message: "close must be a valid HH:mm time",
      },
    },
  },
  { _id: false },
);

export interface BuildingConcierge {
  url: string;
  accessCode: string;
}

export const buildingConciergeSchema = new Schema<BuildingConcierge>(
  {
    url: { type: String, default: "", trim: true },
    accessCode: { type: String, default: "", trim: true },
  },
  { _id: false },
);

export interface Coordinates {
  lat: number;
  lng: number;
}

export const coordinatesSchema = new Schema<Coordinates>(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false },
);

export interface BuildingPhoto {
  storageKey: string;
  alt?: string;
  order: number;
  isPrimary: boolean;
}

export const buildingPhotoSchema = new Schema<BuildingPhoto>(
  {
    storageKey: { type: String, required: true, trim: true },
    alt: { type: String, trim: true },
    order: { type: Number, required: true, min: 0 },
    isPrimary: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

export interface VatBreakdownLine {
  rate: number;
  baseHT: number;
  vat: number;
}

export const vatBreakdownLineSchema = new Schema<VatBreakdownLine>(
  {
    rate: { type: Number, required: true },
    baseHT: centsField(),
    vat: centsField(),
  },
  { _id: false },
);

export interface BillingLine {
  label: string;
  kind: string;
  qty: number;
  unitPriceHT: number;
  vatRate: number;
  discount: number;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
}

export const billingLineSchema = new Schema<BillingLine>(
  {
    label: { type: String, required: true },
    kind: { type: String, required: true },
    qty: { type: Number, required: true, min: 0 },
    unitPriceHT: centsField({ min: 0 }),
    vatRate: { type: Number, required: true },
    discount: centsField({ min: 0 }),
    totalHT: centsField(),
    totalVAT: centsField(),
    totalTTC: centsField(),
  },
  { _id: false },
);

/** Quote line — BillingLine base + space/slot refs + dual calculated/forced pricing. */
export interface QuoteLine {
  lineId: string;
  kind: BillingLineKind | string;
  label: string;

  spaceId?: Types.ObjectId;
  buildingId?: Types.ObjectId;
  startAt?: Date;
  endAt?: Date;
  partySize?: number;
  durationClass?: DurationClass;
  units?: number;

  calculatedUnitPriceHT: number;
  calculatedTotalHT: number;
  calculatedTotalVAT: number;
  calculatedTotalTTC: number;

  forcedUnitPriceHT?: number;
  unitPriceHT: number;
  qty: number;
  vatRate: number;
  discount: number;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;

  priceSource: QuoteLinePriceSource;
  priceOverrideReason?: string;
  priceOverriddenByStaffProfileId?: Types.ObjectId;
  priceOverriddenAt?: Date;
}

export const quoteLineSchema = new Schema<QuoteLine>(
  {
    lineId: { type: String, required: true, trim: true },
    kind: { type: String, enum: BILLING_LINE_KINDS, required: true },
    label: { type: String, required: true },

    spaceId: { type: Schema.Types.ObjectId, ref: "Space", required: false },
    buildingId: { type: Schema.Types.ObjectId, ref: "Building", required: false },
    startAt: { type: Date },
    endAt: { type: Date },
    partySize: { type: Number, min: 1 },
    durationClass: { type: String, enum: DURATION_CLASSES },
    units: { type: Number, min: 0 },

    calculatedUnitPriceHT: centsField({ min: 0 }),
    calculatedTotalHT: centsField(),
    calculatedTotalVAT: centsField(),
    calculatedTotalTTC: centsField(),

    forcedUnitPriceHT: centsField({ required: false, min: 0 }),
    unitPriceHT: centsField({ min: 0 }),
    qty: { type: Number, required: true, min: 0 },
    vatRate: { type: Number, required: true },
    discount: centsField({ min: 0 }),
    totalHT: centsField(),
    totalVAT: centsField(),
    totalTTC: centsField(),

    priceSource: {
      type: String,
      enum: QUOTE_LINE_PRICE_SOURCES,
      required: true,
      default: "auto",
    },
    priceOverrideReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      required: [
        function (this: { priceSource?: string }) {
          return this.priceSource === "forced";
        },
        "priceOverrideReason is required when priceSource is forced",
      ],
    },
    priceOverriddenByStaffProfileId: {
      type: Schema.Types.ObjectId,
      ref: "StaffProfile",
      required: false,
    },
    priceOverriddenAt: { type: Date },
  },
  { _id: false },
);

/** Prospect / clientDraft identity before cardex exists (send without cardex). */
export interface QuoteProspect {
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  companyName?: string;
  billingAddress?: Address;
}

export const quoteProspectSchema = new Schema<QuoteProspect>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    displayName: { type: String, trim: true },
    phone: { type: String, trim: true },
    companyName: { type: String, trim: true },
    billingAddress: { type: addressSchema },
  },
  { _id: false },
);

export interface QuoteAcceptedBy {
  kind: "client" | "staff";
  clientAccountId?: Types.ObjectId;
  staffProfileId?: Types.ObjectId;
}

export const quoteAcceptedBySchema = new Schema<QuoteAcceptedBy>(
  {
    kind: { type: String, enum: ["client", "staff"], required: true },
    clientAccountId: { type: Schema.Types.ObjectId, ref: "ClientAccount", required: false },
    staffProfileId: { type: Schema.Types.ObjectId, ref: "StaffProfile", required: false },
  },
  { _id: false },
);

export interface BillingTotals {
  ht: number;
  vat: number;
  ttc: number;
  discountTotal: number;
}

export const billingTotalsSchema = new Schema<BillingTotals>(
  {
    ht: centsField(),
    vat: centsField(),
    ttc: centsField(),
    discountTotal: centsField({ min: 0 }),
  },
  { _id: false },
);

export interface InvoiceTotals extends BillingTotals {
  paidTotal: number;
  balanceDue: number;
}

export const invoiceTotalsSchema = new Schema<InvoiceTotals>(
  {
    ht: centsField(),
    vat: centsField(),
    ttc: centsField(),
    discountTotal: centsField({ min: 0 }),
    paidTotal: centsField({ min: 0 }),
    balanceDue: centsField(),
  },
  { _id: false },
);

export interface SpaceSnapshot {
  name: string;
  type: string;
}

export const spaceSnapshotSchema = new Schema<SpaceSnapshot>(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
  },
  { _id: false },
);

export interface ReservationServiceCustomAnswer {
  questionId: string;
  type: string;
  label: string;
  value: unknown;
}

export interface ReservationServiceSnapshot {
  serviceId: Types.ObjectId;
  label: string;
  qty: number;
  unitPriceHT: number;
  vatRate: number;
  /** Snapshot of answers collected at booking time (optional). */
  customAnswers?: ReservationServiceCustomAnswer[];
}

const reservationServiceCustomAnswerSchema = new Schema<ReservationServiceCustomAnswer>(
  {
    questionId: { type: String, required: true },
    type: { type: String, required: true },
    label: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false },
);

export const reservationServiceSnapshotSchema = new Schema<ReservationServiceSnapshot>(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    label: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPriceHT: centsField({ min: 0 }),
    vatRate: { type: Number, required: true },
    customAnswers: { type: [reservationServiceCustomAnswerSchema], default: undefined },
  },
  { _id: false },
);

export interface ReservationPricingSnapshot {
  subtotalHT: number;
  totalVAT: number;
  totalTTC: number;
  discountTotal: number;
}

export const reservationPricingSnapshotSchema = new Schema<ReservationPricingSnapshot>(
  {
    subtotalHT: centsField({ min: 0 }),
    totalVAT: centsField({ min: 0 }),
    totalTTC: centsField({ min: 0 }),
    discountTotal: centsField({ min: 0 }),
  },
  { _id: false },
);

export interface StatusHistoryEntry {
  from: string;
  to: string;
  at: Date;
  by?: Schema.Types.ObjectId;
  reason?: string;
}

export const statusHistoryEntrySchema = new Schema<StatusHistoryEntry>(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    at: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId },
    reason: { type: String },
  },
  { _id: false },
);

export interface StaffPermissions {
  planning: boolean;
  billing: boolean;
  clients: boolean;
  stats: boolean;
  spaces: boolean;
  services: boolean;
  promo: boolean;
}

export const staffPermissionsSchema = new Schema<StaffPermissions>(
  {
    planning: { type: Boolean, default: false },
    billing: { type: Boolean, default: false },
    clients: { type: Boolean, default: false },
    stats: { type: Boolean, default: false },
    spaces: { type: Boolean, default: false },
    services: { type: Boolean, default: false },
    promo: { type: Boolean, default: false },
  },
  { _id: false },
);

export interface StaffScope {
  buildingIds: Types.ObjectId[];
  spaceTypes: string[];
}

export const staffScopeSchema = new Schema<StaffScope>(
  {
    buildingIds: [{ type: Schema.Types.ObjectId, ref: "Building" }],
    spaceTypes: [{ type: String }],
  },
  { _id: false },
);

export interface ConsentRecord {
  privacyPolicyVersion: string;
  acceptedAt: Date;
}

export const consentRecordSchema = new Schema<ConsentRecord>(
  {
    privacyPolicyVersion: { type: String, required: true },
    acceptedAt: { type: Date, required: true },
  },
  { _id: false },
);

export interface MarketingConsentRecord {
  accepted: boolean;
  acceptedAt?: Date;
}

export const marketingConsentRecordSchema = new Schema<MarketingConsentRecord>(
  {
    accepted: { type: Boolean, required: true },
    acceptedAt: { type: Date },
  },
  { _id: false },
);

export interface CardexIdentity {
  firstName: string;
  lastName: string;
  phone?: string;
}

export const cardexIdentitySchema = new Schema<CardexIdentity>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String },
  },
  { _id: false },
);

export interface CardexCompany {
  legalName: string;
  siret?: string;
  vatNumber?: string;
  billingAddress?: Address;
}

export const cardexCompanySchema = new Schema<CardexCompany>(
  {
    legalName: { type: String, required: true },
    siret: { type: String },
    vatNumber: { type: String },
    billingAddress: { type: addressSchema },
  },
  { _id: false },
);

/** Max length for optional staff label (e.g. "RIB", "Pièce d'identité"). */
export const CARDEX_DOCUMENT_LABEL_MAX_LENGTH = 120;

/**
 * Metadata for a staff-uploaded file on a cardex (Contrats / Autres).
 * Facturation PDFs live on `Invoice`, not in this array.
 * `_id` is enabled so download/delete can target a document within a specific cardex.
 */
export interface CardexDocumentMeta {
  category: CardexDocumentCategory;
  /** Future client space: true for contracts, false for "other". */
  clientVisible: boolean;
  /** Optional short staff note (e.g. "RIB") — independent of originalFilename. */
  label?: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedAt: Date;
  uploadedByStaffProfileId: Types.ObjectId;
}

export const cardexDocumentMetaSchema = new Schema<CardexDocumentMeta>(
  {
    category: { type: String, enum: CARDEX_DOCUMENT_CATEGORIES, required: true },
    clientVisible: { type: Boolean, required: true },
    label: { type: String, maxlength: CARDEX_DOCUMENT_LABEL_MAX_LENGTH },
    originalFilename: { type: String, required: true },
    contentType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    storageKey: { type: String, required: true },
    uploadedAt: { type: Date, required: true },
    uploadedByStaffProfileId: objectIdRef("StaffProfile"),
  },
  // Keep Mongo `_id` on each entry so staff APIs can scope download/delete to cardexId + documentId.
);

export interface BillingSummary {
  depositsTotal: number;
  balanceDue: number;
}

export const billingSummarySchema = new Schema<BillingSummary>(
  {
    depositsTotal: centsField({ min: 0 }),
    balanceDue: centsField(),
  },
  { _id: false },
);

export interface AuditActor {
  kind: string;
  id: Types.ObjectId | string;
}

export const auditActorSchema = new Schema<AuditActor>(
  {
    kind: { type: String, required: true },
    id: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false },
);

export interface AuditEntity {
  type: string;
  id: Types.ObjectId;
}

export const auditEntitySchema = new Schema<AuditEntity>(
  {
    type: { type: String, required: true },
    id: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false },
);

export interface AuditDiffEntry {
  before: unknown;
  after: unknown;
}

export const auditDiffSchema = new Schema<Record<string, AuditDiffEntry>>(
  {},
  { _id: false, strict: false },
);

export interface ReconciliationInfo {
  status: string;
  qontoTxId?: string;
  /** Stripe PaymentIntent id — unique sparse index for webhook idempotence. */
  stripePaymentIntentId?: string;
  /** Stripe Refund id (`re_…`) — unique sparse index for refund webhook idempotence. */
  stripeRefundId?: string;
  /** Client-supplied Stripe Idempotency-Key for refunds.create (unique sparse). */
  idempotencyKey?: string;
  /** Staff note when marking a manual (off-Stripe) transfer refund. */
  manualNote?: string;
}

export const reconciliationSchema = new Schema<ReconciliationInfo>(
  {
    status: { type: String, required: true },
    qontoTxId: { type: String },
    stripePaymentIntentId: { type: String },
    stripeRefundId: { type: String },
    idempotencyKey: { type: String },
    manualNote: { type: String },
  },
  { _id: false },
);

export interface DiscountPerimeter {
  appliesTo: string;
  serviceKeys?: string[];
}

export const discountPerimeterSchema = new Schema<DiscountPerimeter>(
  {
    appliesTo: { type: String, required: true },
    serviceKeys: [{ type: String }],
  },
  { _id: false },
);

export interface SlotClosureScope {
  buildingId?: Types.ObjectId;
  spaceId?: Types.ObjectId;
  spaceType?: string;
}

export const slotClosureScopeSchema = new Schema<SlotClosureScope>(
  {
    buildingId: { type: Schema.Types.ObjectId, ref: "Building" },
    spaceId: { type: Schema.Types.ObjectId, ref: "Space" },
    spaceType: { type: String },
  },
  { _id: false },
);

export interface TariffScope {
  spaceId?: Types.ObjectId;
  spaceType?: string;
}

export const tariffScopeSchema = new Schema<TariffScope>(
  {
    spaceId: { type: Schema.Types.ObjectId, ref: "Space" },
    spaceType: { type: String },
  },
  { _id: false },
);

export interface ReservationRequestContact {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
}

export const reservationRequestContactSchema = new Schema<ReservationRequestContact>(
  {
    email: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String },
    company: { type: String },
  },
  { _id: false },
);
