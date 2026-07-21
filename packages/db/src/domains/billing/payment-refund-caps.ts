/**
 * Compute Stripe / manual transfer refund ceilings from invoice payments.
 * Caps are net of already-succeeded refunds (matched), in integer cents.
 */

export interface PaymentRefundCapRow {
  kind: string;
  method: string;
  amount: number;
  reconciliation: {
    status: string;
    stripeRefundId?: string | null;
  };
}

export type RefundExecution = "stripe_card" | "manual_transfer" | "none";

export interface PaymentRefundCaps {
  cardPaidCents: number;
  cardRefundedCents: number;
  stripeRefundableCents: number;
  transferPaidCents: number;
  transferRefundedCents: number;
  transferRefundableCents: number;
  refundExecution: RefundExecution;
}

function asNonNegInt(value: number): number {
  return Number.isInteger(value) && value > 0 ? value : 0;
}

/**
 * cardRefundedSucceeded = refunds kind=refund method=card status=matched with stripeRefundId.
 * transferRefundedMatched = refunds kind=refund method=transfer status=matched.
 * pending/failed refunds do not reduce the ceiling (allows retry after failure).
 */
export function computePaymentRefundCaps(payments: PaymentRefundCapRow[]): PaymentRefundCaps {
  let cardPaidCents = 0;
  let cardRefundedCents = 0;
  let transferPaidCents = 0;
  let transferRefundedCents = 0;

  for (const payment of payments) {
    const amount = asNonNegInt(Math.trunc(payment.amount));
    if (amount === 0) continue;

    if (payment.kind === "refund") {
      if (payment.reconciliation.status !== "matched") continue;
      if (payment.method === "card" && payment.reconciliation.stripeRefundId) {
        cardRefundedCents += amount;
      } else if (payment.method === "transfer") {
        transferRefundedCents += amount;
      }
      continue;
    }

    if (payment.method === "card") {
      cardPaidCents += amount;
    } else if (payment.method === "transfer") {
      transferPaidCents += amount;
    }
  }

  const stripeRefundableCents = Math.max(0, cardPaidCents - cardRefundedCents);
  const transferRefundableCents = Math.max(0, transferPaidCents - transferRefundedCents);

  let refundExecution: RefundExecution = "none";
  if (stripeRefundableCents > 0) {
    refundExecution = "stripe_card";
  } else if (transferRefundableCents > 0) {
    refundExecution = "manual_transfer";
  }

  return {
    cardPaidCents,
    cardRefundedCents,
    stripeRefundableCents,
    transferPaidCents,
    transferRefundedCents,
    transferRefundableCents,
    refundExecution,
  };
}
