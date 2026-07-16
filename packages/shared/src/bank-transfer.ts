/** Shared bank-transfer eligibility and payment-window helpers (vitrine + gestion). */

export const DEFAULT_BANK_TRANSFER_MIN_LEAD_DAYS = 7;
export const DEFAULT_BANK_TRANSFER_PAYMENT_WINDOW_DAYS = 8;
export const DEFAULT_BANK_TRANSFER_SAFETY_MARGIN_DAYS = 2;

export const BANK_TRANSFER_REMINDER_TIERS = ["j2", "j4", "j6"] as const;
export type BankTransferReminderTier = (typeof BANK_TRANSFER_REMINDER_TIERS)[number];

export const BANK_TRANSFER_REMINDER_OFFSET_DAYS: Record<BankTransferReminderTier, number> = {
  j2: 2,
  j4: 4,
  j6: 6,
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Lead-time gate: reservation start must be at least `minLeadDays` calendar days after `now`.
 * Uses UTC calendar days for a stable server/front comparison.
 */
export function isBankTransferLeadTimeEligible(
  startAt: Date,
  now: Date,
  minLeadDays: number = DEFAULT_BANK_TRANSFER_MIN_LEAD_DAYS,
): boolean {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(now.getTime())) {
    return false;
  }
  if (!Number.isFinite(minLeadDays) || minLeadDays < 0) {
    return false;
  }
  const minStart = addUtcDays(startOfUtcDay(now), minLeadDays);
  return startOfUtcDay(startAt).getTime() >= minStart.getTime();
}

export type BankTransferExpiryResult =
  { ok: true; expiresAt: Date } | { ok: false; reason: "window_too_short" | "invalid_dates" };

/**
 * Payment window from invoice issuance, capped by reservation start minus safety margin.
 * Rejects when the computed expiry is not strictly after `issuedAt` (edge: lead OK but window empty).
 */
export function computeBankTransferExpiresAt(input: {
  issuedAt: Date;
  startAt: Date;
  paymentWindowDays?: number;
  safetyMarginDays?: number;
}): BankTransferExpiryResult {
  const paymentWindowDays = input.paymentWindowDays ?? DEFAULT_BANK_TRANSFER_PAYMENT_WINDOW_DAYS;
  const safetyMarginDays = input.safetyMarginDays ?? DEFAULT_BANK_TRANSFER_SAFETY_MARGIN_DAYS;

  if (
    Number.isNaN(input.issuedAt.getTime()) ||
    Number.isNaN(input.startAt.getTime()) ||
    !Number.isFinite(paymentWindowDays) ||
    !Number.isFinite(safetyMarginDays)
  ) {
    return { ok: false, reason: "invalid_dates" };
  }

  const fromWindow = addUtcDays(input.issuedAt, paymentWindowDays);
  const fromReservation = addUtcDays(input.startAt, -safetyMarginDays);
  const expiresAt = new Date(Math.min(fromWindow.getTime(), fromReservation.getTime()));

  if (expiresAt.getTime() <= input.issuedAt.getTime()) {
    return { ok: false, reason: "window_too_short" };
  }

  return { ok: true, expiresAt };
}

export function isBankTransferFullyEligible(input: {
  startAt: Date;
  now: Date;
  minLeadDays?: number;
  paymentWindowDays?: number;
  safetyMarginDays?: number;
}): boolean {
  if (
    !isBankTransferLeadTimeEligible(
      input.startAt,
      input.now,
      input.minLeadDays ?? DEFAULT_BANK_TRANSFER_MIN_LEAD_DAYS,
    )
  ) {
    return false;
  }
  const expiry = computeBankTransferExpiresAt({
    issuedAt: input.now,
    startAt: input.startAt,
    paymentWindowDays: input.paymentWindowDays,
    safetyMarginDays: input.safetyMarginDays,
  });
  return expiry.ok;
}
