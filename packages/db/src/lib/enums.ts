/** Shared enum values for cowork_bdd collections. */

export const ACTIVE_STATUSES = ["active", "inactive"] as const;
export type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

export const SPACE_TYPES = ["meeting_room", "private_office"] as const;
export type SpaceType = (typeof SPACE_TYPES)[number];

export const SLOT_CLOSURE_KINDS = ["closed", "open_exception"] as const;
export type SlotClosureKind = (typeof SLOT_CLOSURE_KINDS)[number];

export const RESERVATION_TYPES = [
  "meeting_room",
  "private_office",
  "long_term",
  "recurring",
] as const;
export type ReservationType = (typeof RESERVATION_TYPES)[number];

export const DURATION_CLASSES = ["hourly", "halfday", "daily", "weekly", "monthly"] as const;
export type DurationClass = (typeof DURATION_CLASSES)[number];

export const RESERVATION_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const BLOCKING_RESERVATION_STATUSES = ["pending", "confirmed"] as const;

export const CREATED_CHANNELS = ["online", "staff", "phone"] as const;
export type CreatedChannel = (typeof CREATED_CHANNELS)[number];

export const CLIENT_ACCOUNT_STATUSES = ["active", "locked", "anonymized"] as const;
export type ClientAccountStatus = (typeof CLIENT_ACCOUNT_STATUSES)[number];

export const RETENTION_STATUSES = ["active", "pending_anonymization", "anonymized"] as const;
export type RetentionStatus = (typeof RETENTION_STATUSES)[number];

export const CARDEX_DOCUMENT_KINDS = ["rib", "id", "insurance"] as const;
export type CardexDocumentKind = (typeof CARDEX_DOCUMENT_KINDS)[number];

export const STAFF_ROLES = ["manager", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_STATUSES = ["active", "revoked"] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const AUDIT_ACTOR_KINDS = ["staff", "client", "system"] as const;
export type AuditActorKind = (typeof AUDIT_ACTOR_KINDS)[number];

export const TARIFF_STATUSES = ["active", "inactive"] as const;
export type TariffStatus = (typeof TARIFF_STATUSES)[number];

export const SERVICE_STATUSES = ["active", "inactive"] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const DISCOUNT_CODE_KINDS = ["promo", "preferential"] as const;
export type DiscountCodeKind = (typeof DISCOUNT_CODE_KINDS)[number];

export const DISCOUNT_TYPES = ["percentage", "fixed_amount", "buy_one_get_one"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DISCOUNT_APPLIES_TO = ["order", "space", "service"] as const;
export type DiscountAppliesTo = (typeof DISCOUNT_APPLIES_TO)[number];

export const DISCOUNT_CODE_STATUSES = ["active", "expired", "disabled"] as const;
export type DiscountCodeStatus = (typeof DISCOUNT_CODE_STATUSES)[number];

export const QUOTE_STATUSES = ["sent", "accepted", "refused", "expired"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const INVOICE_TYPES = ["proforma", "final"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const PAYMENT_SITUATIONS = ["immediate", "on_quote", "deposit", "net_30"] as const;
export type PaymentSituation = (typeof PAYMENT_SITUATIONS)[number];

export const INVOICE_STATUSES = [
  "proforma",
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_KINDS = ["deposit", "balance", "full"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_METHODS = ["card", "transfer", "direct_debit", "cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const RECONCILIATION_STATUSES = ["pending", "matched"] as const;
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

export const NOTIFICATION_TEMPLATES = [
  "confirmation",
  "j-7",
  "j-1",
  "dunning",
  "satisfaction",
] as const;
export type NotificationTemplate = (typeof NOTIFICATION_TEMPLATES)[number];

export const NOTIFICATION_CHANNELS = ["email"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ["pending", "sent", "failed", "cancelled"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const REVIEW_SOURCES = ["site", "google"] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

export const REVIEW_STATUSES = ["pending", "approved"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const SATISFACTION_LEVELS = ["excellent", "good", "neutral", "poor", "bad"] as const;
export type SatisfactionLevel = (typeof SATISFACTION_LEVELS)[number];

export const NEWS_OFFER_KINDS = ["news", "offer"] as const;
export type NewsOfferKind = (typeof NEWS_OFFER_KINDS)[number];

export const NEWS_OFFER_STATUSES = ["draft", "published", "archived"] as const;
export type NewsOfferStatus = (typeof NEWS_OFFER_STATUSES)[number];

export const INCIDENT_REPORTER_KINDS = ["client", "staff"] as const;
export type IncidentReporterKind = (typeof INCIDENT_REPORTER_KINDS)[number];

export const INCIDENT_STATUSES = ["open", "in_progress", "resolved"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const RESERVATION_REQUEST_TYPES = ["long_term", "recurring"] as const;
export type ReservationRequestType = (typeof RESERVATION_REQUEST_TYPES)[number];

export const RESERVATION_REQUEST_STATUSES = [
  "pending",
  "in_progress",
  "converted",
  "closed",
] as const;
export type ReservationRequestStatus = (typeof RESERVATION_REQUEST_STATUSES)[number];

export const BILLING_LINE_KINDS = ["space", "service", "fee", "discount", "other"] as const;
export type BillingLineKind = (typeof BILLING_LINE_KINDS)[number];
