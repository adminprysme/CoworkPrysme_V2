/**
 * Pure helpers for Planning Wave 2 manage actions (cents-only arithmetic).
 */

import { computeTtcCents } from "./money.js";
import type { SpaceDurationClass } from "./spaces.js";

/** Inclusive Paris-day threshold before a weekly tariff may apply. */
export const SPACE_STAY_WEEKLY_MIN_DAYS = 7;
/** Inclusive Paris-day threshold before a monthly tariff may apply (aligns with booking UI). */
export const SPACE_STAY_MONTHLY_MIN_DAYS = 28;

export type SuggestedRefundBasis = "not_started" | "in_progress" | "ended" | "unpaid";

export interface SuggestedRefundInput {
  /** Reservation start (inclusive). */
  startAt: Date;
  /** Reservation end (exclusive or inclusive — duration uses end - start). */
  endAt: Date;
  /** Amount already paid on the proforma, in integer centimes. */
  paidTotalCents: number;
  /** Clock used for the suggestion (defaults to now). */
  now?: Date;
}

export interface SuggestedRefundResult {
  basis: SuggestedRefundBasis;
  /** Suggested refund in integer centimes (never applied automatically). */
  suggestedRefundCents: number;
  paidTotalCents: number;
  totalDurationMs: number;
  remainingMs: number;
  elapsedMs: number;
}

/**
 * Suggested refund for staff cancellation:
 * - unpaid → 0
 * - not started → full paid amount
 * - in progress → prorata of remaining time over total duration (integer cents)
 * - ended → 0
 */
export function computeSuggestedRefundCents(input: SuggestedRefundInput): SuggestedRefundResult {
  const paidTotalCents = input.paidTotalCents;
  if (!Number.isInteger(paidTotalCents) || paidTotalCents < 0) {
    throw new RangeError("paidTotalCents must be a non-negative integer");
  }

  const now = input.now ?? new Date();
  const startMs = input.startAt.getTime();
  const endMs = input.endAt.getTime();
  if (!(endMs > startMs)) {
    throw new RangeError("endAt must be after startAt");
  }

  const totalDurationMs = endMs - startMs;
  const remainingMs = Math.max(0, endMs - now.getTime());
  const elapsedMs = Math.min(totalDurationMs, Math.max(0, now.getTime() - startMs));

  if (paidTotalCents === 0) {
    return {
      basis: "unpaid",
      suggestedRefundCents: 0,
      paidTotalCents,
      totalDurationMs,
      remainingMs,
      elapsedMs,
    };
  }

  if (now.getTime() < startMs) {
    return {
      basis: "not_started",
      suggestedRefundCents: paidTotalCents,
      paidTotalCents,
      totalDurationMs,
      remainingMs: totalDurationMs,
      elapsedMs: 0,
    };
  }

  if (now.getTime() >= endMs) {
    return {
      basis: "ended",
      suggestedRefundCents: 0,
      paidTotalCents,
      totalDurationMs,
      remainingMs: 0,
      elapsedMs: totalDurationMs,
    };
  }

  // Integer prorata: floor toward zero via Math.round on remaining/total * paid.
  const suggestedRefundCents = Math.round((paidTotalCents * remainingMs) / totalDurationMs);

  return {
    basis: "in_progress",
    suggestedRefundCents: Math.min(paidTotalCents, Math.max(0, suggestedRefundCents)),
    paidTotalCents,
    totalDurationMs,
    remainingMs,
    elapsedMs,
  };
}

export interface PriceDeltaCents {
  previousTotalTTC: number;
  nextTotalTTC: number;
  deltaTTC: number;
}

export function computePriceDeltaCents(
  previousTotalTTC: number,
  nextTotalTTC: number,
): PriceDeltaCents {
  if (!Number.isInteger(previousTotalTTC) || previousTotalTTC < 0) {
    throw new RangeError("previousTotalTTC must be a non-negative integer");
  }
  if (!Number.isInteger(nextTotalTTC) || nextTotalTTC < 0) {
    throw new RangeError("nextTotalTTC must be a non-negative integer");
  }
  return {
    previousTotalTTC,
    nextTotalTTC,
    deltaTTC: nextTotalTTC - previousTotalTTC,
  };
}

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const PARIS_TZ = "Europe/Paris";

export type CgvRefundScaleRatio = 0 | 0.5 | 1;

export interface CgvRefundScaleInput {
  durationClass: SpaceDurationClass;
  startAt: Date;
  now?: Date;
}

export interface CgvRefundScaleResult {
  ratio: CgvRefundScaleRatio;
  hoursBeforeStart: number;
  band: string;
}

/** Alias for {@link CgvRefundScaleResult} (CDC/CGV Art.5.1 scale outcome). */
export type CgvRefundScale = CgvRefundScaleResult;

/**
 * CDC/CGV Art.5.1 refund scale by duration class and lead time before start.
 * Boundaries use half-open intervals on the lower band (e.g. 24 ≤ h < 48 → 0.5).
 */
export function computeCgvScaleRatio(input: CgvRefundScaleInput): CgvRefundScaleResult {
  const now = input.now ?? new Date();
  const hoursBeforeStart = (input.startAt.getTime() - now.getTime()) / MS_PER_HOUR;
  const daysBeforeStart = (input.startAt.getTime() - now.getTime()) / MS_PER_DAY;

  switch (input.durationClass) {
    case "hourly":
    case "halfday": {
      if (hoursBeforeStart >= 48) {
        return { ratio: 1, hoursBeforeStart, band: "Plus de 48 heures" };
      }
      if (hoursBeforeStart >= 24) {
        return { ratio: 0.5, hoursBeforeStart, band: "Entre 24 et 48 heures" };
      }
      return { ratio: 0, hoursBeforeStart, band: "Moins de 24 heures" };
    }
    case "daily": {
      if (daysBeforeStart >= 7) {
        return { ratio: 1, hoursBeforeStart, band: "Plus de 7 jours" };
      }
      if (daysBeforeStart >= 3) {
        return { ratio: 0.5, hoursBeforeStart, band: "Entre 3 et 7 jours" };
      }
      return { ratio: 0, hoursBeforeStart, band: "Moins de 3 jours" };
    }
    case "weekly": {
      if (daysBeforeStart >= 14) {
        return { ratio: 1, hoursBeforeStart, band: "Plus de 14 jours" };
      }
      if (daysBeforeStart >= 7) {
        return { ratio: 0.5, hoursBeforeStart, band: "Entre 7 et 14 jours" };
      }
      return { ratio: 0, hoursBeforeStart, band: "Moins de 7 jours" };
    }
    case "monthly": {
      if (daysBeforeStart >= 30) {
        return { ratio: 1, hoursBeforeStart, band: "Plus de 30 jours" };
      }
      if (daysBeforeStart >= 15) {
        return { ratio: 0.5, hoursBeforeStart, band: "Entre 15 et 30 jours" };
      }
      return { ratio: 0, hoursBeforeStart, band: "Moins de 15 jours" };
    }
    default: {
      const _exhaustive: never = input.durationClass;
      throw new RangeError(`Unknown durationClass: ${String(_exhaustive)}`);
    }
  }
}

export interface CgvScaleRefundInput {
  durationClass: SpaceDurationClass;
  startAt: Date;
  paidTotalCents: number;
  now?: Date;
}

export interface CgvScaleRefundResult extends CgvRefundScaleResult {
  paidTotalCents: number;
  suggestedRefundCents: number;
}

/**
 * Suggested refund from CGV Art.5.1 scale: round(paid × ratio), capped to paid.
 */
export function computeCgvScaleRefundCents(input: CgvScaleRefundInput): CgvScaleRefundResult {
  const paidTotalCents = input.paidTotalCents;
  if (!Number.isInteger(paidTotalCents) || paidTotalCents < 0) {
    throw new RangeError("paidTotalCents must be a non-negative integer");
  }

  const scale = computeCgvScaleRatio({
    durationClass: input.durationClass,
    startAt: input.startAt,
    now: input.now,
  });
  const suggestedRefundCents = Math.min(
    paidTotalCents,
    Math.max(0, Math.round(paidTotalCents * scale.ratio)),
  );

  return {
    ...scale,
    paidTotalCents,
    suggestedRefundCents,
  };
}

export type DateChangeKind = "extend" | "shorten" | "shift";

export interface ClassifyDateChangeInput {
  oldStart: Date;
  oldEnd: Date;
  newStart: Date;
  newEnd: Date;
}

/**
 * Classifies a date-range edit as extend / shorten / shift.
 */
export function classifyDateChange(input: ClassifyDateChangeInput): DateChangeKind {
  const oldStart = input.oldStart.getTime();
  const oldEnd = input.oldEnd.getTime();
  const newStart = input.newStart.getTime();
  const newEnd = input.newEnd.getTime();

  if (!(oldEnd > oldStart) || !(newEnd > newStart)) {
    throw new RangeError("end must be after start for both old and new intervals");
  }

  const oldMs = oldEnd - oldStart;
  const newMs = newEnd - newStart;

  if (newStart <= oldStart && newEnd >= oldEnd && newMs > oldMs) {
    return "extend";
  }
  if (newStart >= oldStart && newEnd <= oldEnd && newMs < oldMs) {
    return "shorten";
  }
  if (newMs === oldMs && newStart !== oldStart) {
    return "shift";
  }
  if (newMs > oldMs) {
    return "extend";
  }
  if (newMs < oldMs) {
    return "shorten";
  }
  return "shift";
}

function parisCalendarDayKey(date: Date): string {
  return date.toLocaleDateString("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** Inclusive calendar-day count between two YYYY-MM-DD keys (Paris). */
function inclusiveParisDayCount(startKey: string, endKey: string): number {
  const startParts = startKey.split("-").map(Number);
  const endParts = endKey.split("-").map(Number);
  const sy = startParts[0];
  const sm = startParts[1];
  const sd = startParts[2];
  const ey = endParts[0];
  const em = endParts[1];
  const ed = endParts[2];
  if (
    sy == null ||
    sm == null ||
    sd == null ||
    ey == null ||
    em == null ||
    ed == null ||
    ![sy, sm, sd, ey, em, ed].every((n) => Number.isFinite(n))
  ) {
    throw new RangeError(`Invalid Paris day key: ${startKey} / ${endKey}`);
  }
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);
  return Math.floor((endUtc - startUtc) / MS_PER_DAY) + 1;
}

/**
 * Billable unit count for a stay by duration class.
 * Daily uses inclusive Paris calendar days from start through end−1ms.
 */
export function countBillableUnits(
  startAt: Date,
  endAt: Date,
  durationClass: SpaceDurationClass,
): number {
  const startMs = startAt.getTime();
  const endMs = endAt.getTime();
  if (!(endMs > startMs)) {
    throw new RangeError("endAt must be after startAt");
  }
  const ms = endMs - startMs;

  switch (durationClass) {
    case "hourly":
      return Math.max(1, Math.ceil(ms / MS_PER_HOUR));
    case "halfday":
      return Math.max(1, Math.ceil(ms / (4 * MS_PER_HOUR)));
    case "daily": {
      const startKey = parisCalendarDayKey(startAt);
      const endKey = parisCalendarDayKey(new Date(endMs - 1));
      return Math.max(1, inclusiveParisDayCount(startKey, endKey));
    }
    case "weekly": {
      const dailyUnits = countBillableUnits(startAt, endAt, "daily");
      return Math.max(1, Math.ceil(dailyUnits / 7));
    }
    case "monthly": {
      const dailyUnits = countBillableUnits(startAt, endAt, "daily");
      return Math.max(1, Math.ceil(dailyUnits / 30));
    }
    default: {
      const _exhaustive: never = durationClass;
      throw new RangeError(`Unknown durationClass: ${String(_exhaustive)}`);
    }
  }
}

export interface SpaceTariffCandidate {
  durationClass: SpaceDurationClass;
  priceHT: number;
  vatRate: number;
  enabled?: boolean;
}

export interface SpaceStayPricing {
  durationClass: SpaceDurationClass;
  units: number;
  unitPriceHT: number;
  vatRate: number;
  spaceHT: number;
  spaceTTC: number;
}

/**
 * Whether a duration-class tariff may be offered for this stay length.
 * Prevents e.g. a monthly forfait from winning on a 2-day stay via ceil(days/30)=1.
 */
export function isSpaceTariffApplicableToStay(
  durationClass: SpaceDurationClass,
  startAt: Date,
  endAt: Date,
): boolean {
  const dailyUnits = countBillableUnits(startAt, endAt, "daily");
  const ms = endAt.getTime() - startAt.getTime();

  switch (durationClass) {
    case "hourly":
      return dailyUnits <= 1;
    case "halfday":
      return dailyUnits <= 1 && ms <= 6 * MS_PER_HOUR;
    case "daily":
      return true;
    case "weekly":
      return dailyUnits >= SPACE_STAY_WEEKLY_MIN_DAYS;
    case "monthly":
      return dailyUnits >= SPACE_STAY_MONTHLY_MIN_DAYS;
    default: {
      const _exhaustive: never = durationClass;
      throw new RangeError(`Unknown durationClass: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Price a stay by selecting the cheapest applicable enabled tariff tier
 * (not a linear extrapolation of the original booking's durationClass).
 */
export function resolveSpaceStayPricing(input: {
  startAt: Date;
  endAt: Date;
  tariffs: ReadonlyArray<SpaceTariffCandidate>;
}): SpaceStayPricing {
  const enabled = input.tariffs.filter(
    (tariff) =>
      tariff.enabled !== false &&
      Number.isInteger(tariff.priceHT) &&
      tariff.priceHT >= 0 &&
      isSpaceTariffApplicableToStay(tariff.durationClass, input.startAt, input.endAt),
  );
  if (enabled.length === 0) {
    throw new RangeError("Aucun tarif applicable pour cette durée sur cet espace");
  }

  let best: SpaceStayPricing | null = null;
  for (const tariff of enabled) {
    const units = countBillableUnits(input.startAt, input.endAt, tariff.durationClass);
    const spaceHT = units * tariff.priceHT;
    const spaceTTC = computeTtcCents(spaceHT, tariff.vatRate);
    const candidate: SpaceStayPricing = {
      durationClass: tariff.durationClass,
      units,
      unitPriceHT: tariff.priceHT,
      vatRate: tariff.vatRate,
      spaceHT,
      spaceTTC,
    };
    if (
      !best ||
      candidate.spaceHT < best.spaceHT ||
      (candidate.spaceHT === best.spaceHT &&
        SPACE_DURATION_RANK[candidate.durationClass] > SPACE_DURATION_RANK[best.durationClass])
    ) {
      best = candidate;
    }
  }
  return best!;
}

const SPACE_DURATION_RANK: Record<SpaceDurationClass, number> = {
  hourly: 0,
  halfday: 1,
  daily: 2,
  weekly: 3,
  monthly: 4,
};

export type ShortenRefundBasis = "cgv_scale" | "prorata_removed" | "ended" | "unpaid";

export interface ShortenRefundSuggestionInput {
  durationClass: SpaceDurationClass;
  oldStart: Date;
  oldEnd: Date;
  newStart: Date;
  newEnd: Date;
  paidTotalCents: number;
  now?: Date;
}

export interface ShortenRefundSuggestionResult {
  basis: ShortenRefundBasis;
  suggestedRefundCents: number;
  removedValueCents: number;
  cgvRatio?: CgvRefundScaleRatio;
  detail: string;
}

/**
 * Suggested refund when shortening reservation dates (CGV scale if not started,
 * prorata of removed portion if in progress, 0 if ended/unpaid).
 */
export function computeShortenRefundSuggestion(
  input: ShortenRefundSuggestionInput,
): ShortenRefundSuggestionResult {
  const paidTotalCents = input.paidTotalCents;
  if (!Number.isInteger(paidTotalCents) || paidTotalCents < 0) {
    throw new RangeError("paidTotalCents must be a non-negative integer");
  }

  const oldStartMs = input.oldStart.getTime();
  const oldEndMs = input.oldEnd.getTime();
  const newStartMs = input.newStart.getTime();
  const newEndMs = input.newEnd.getTime();
  if (!(oldEndMs > oldStartMs) || !(newEndMs > newStartMs)) {
    throw new RangeError("end must be after start for both old and new intervals");
  }

  const oldMs = oldEndMs - oldStartMs;
  const newMs = newEndMs - newStartMs;
  const removedMs = Math.max(0, oldMs - newMs);
  const removedValueCents = oldMs > 0 ? Math.round((paidTotalCents * removedMs) / oldMs) : 0;

  if (paidTotalCents === 0) {
    return {
      basis: "unpaid",
      suggestedRefundCents: 0,
      removedValueCents,
      detail: "Aucun paiement — remboursement suggéré 0.",
    };
  }

  const now = input.now ?? new Date();
  const nowMs = now.getTime();

  if (nowMs >= oldEndMs) {
    return {
      basis: "ended",
      suggestedRefundCents: 0,
      removedValueCents,
      detail: "Réservation terminée — remboursement suggéré 0.",
    };
  }

  if (nowMs < oldStartMs) {
    const scale = computeCgvScaleRatio({
      durationClass: input.durationClass,
      startAt: input.oldStart,
      now,
    });
    const suggestedRefundCents = Math.min(
      paidTotalCents,
      Math.max(0, Math.round(removedValueCents * scale.ratio)),
    );
    return {
      basis: "cgv_scale",
      suggestedRefundCents,
      removedValueCents,
      cgvRatio: scale.ratio,
      detail: `Non démarrée — barème CGV ${scale.band} (ratio ${scale.ratio}) sur la portion retirée.`,
    };
  }

  // In progress: prorata on removed portion value.
  const suggestedRefundCents = Math.min(paidTotalCents, Math.max(0, removedValueCents));
  return {
    basis: "prorata_removed",
    suggestedRefundCents,
    removedValueCents,
    detail: "En cours — remboursement prorata de la portion retirée.",
  };
}

/** True when fewer than 48 hours remain before start (or start already passed). */
export function isWithin48hOfStart(startAt: Date, now?: Date): boolean {
  const clock = now ?? new Date();
  const hoursBeforeStart = (startAt.getTime() - clock.getTime()) / MS_PER_HOUR;
  return hoursBeforeStart < 48;
}
