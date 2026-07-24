/**
 * LOCKED #5 — payment-link amount from quote paymentSituation / deposit.
 * `depositAmountTTC` when depositPercent > 0, else full TTC balance.
 */
export function resolveQuotePaymentLinkAmountCents(quote: {
  depositPercent?: number | null;
  depositAmountTTC?: number | null;
  totals: { ttc: number };
}): number {
  const depositPercent = Math.max(0, Math.trunc(quote.depositPercent ?? 0));
  if (depositPercent > 0) {
    const snapshot = quote.depositAmountTTC;
    if (typeof snapshot === "number" && Number.isInteger(snapshot) && snapshot > 0) {
      return snapshot;
    }
    // Fallback if snapshot missing — round like shared deposit engine.
    return Math.round((quote.totals.ttc * depositPercent) / 100);
  }
  return Math.max(0, Math.trunc(quote.totals.ttc));
}
