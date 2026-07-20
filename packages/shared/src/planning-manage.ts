/**
 * Pure helpers for Planning Wave 2 manage actions (cents-only arithmetic).
 */

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
