/**
 * Wave 2 "Gérer les dates" invoice append helper.
 *
 * Post-master rule (CDC §4): once a reservation has an invoice, staff manage
 * actions must APPEND adjustment lines rather than silently rewriting the
 * original snapshot lines. This keeps the original space/services lines
 * intact for audit/trace while reflecting the billed complement.
 *
 * Only ever called for POSITIVE amounts (extend / shift-up complement that
 * staff explicitly chose to bill). Shortening a stay never auto-applies a
 * refund to the invoice — it only produces a staff-traced suggestion (see
 * `computeShortenRefundSuggestion`), exactly like the cancel flow.
 */
import type { InvoiceDocument } from "@coworkprysme/db";

export interface AppendInvoiceAdjustmentInput {
  label: string;
  /** Must be a strictly positive integer amount in cents (TTC). */
  amountTTCCents: number;
  vatRate: number;
  kind?: "fee" | "other";
}

/**
 * Appends a billing adjustment line (HT/VAT split back out of the TTC
 * amount) and recomputes invoice totals + VAT breakdown. `paidTotal` is kept
 * untouched — only `balanceDue` grows. No-op when `amountTTCCents <= 0`.
 */
export async function appendInvoiceAdjustment(
  invoice: InvoiceDocument,
  input: AppendInvoiceAdjustmentInput,
): Promise<void> {
  const totalTTC = Math.trunc(input.amountTTCCents);
  if (!Number.isInteger(totalTTC) || totalTTC <= 0) {
    return;
  }

  const totalHT = Math.round((totalTTC * 100) / (100 + input.vatRate));
  const totalVAT = totalTTC - totalHT;

  invoice.lines.push({
    label: input.label,
    kind: input.kind ?? "fee",
    qty: 1,
    unitPriceHT: totalHT,
    vatRate: input.vatRate,
    discount: 0,
    totalHT,
    totalVAT,
    totalTTC,
  } as (typeof invoice.lines)[number]);

  const paidTotal = Math.trunc(invoice.totals.paidTotal);
  const nextHT = Math.trunc(invoice.totals.ht) + totalHT;
  const nextVAT = Math.trunc(invoice.totals.vat) + totalVAT;
  const nextTTC = Math.trunc(invoice.totals.ttc) + totalTTC;
  const balanceDue = Math.max(0, nextTTC - paidTotal);

  invoice.totals = {
    ht: nextHT,
    vat: nextVAT,
    ttc: nextTTC,
    discountTotal: Math.trunc(invoice.totals.discountTotal),
    paidTotal,
    balanceDue,
  };

  const breakdown = invoice.vatBreakdown.map((line) => ({
    rate: line.rate,
    baseHT: Math.trunc(line.baseHT),
    vat: Math.trunc(line.vat),
  }));
  const existing = breakdown.find((line) => line.rate === input.vatRate);
  if (existing) {
    existing.baseHT += totalHT;
    existing.vat += totalVAT;
  } else {
    breakdown.push({ rate: input.vatRate, baseHT: totalHT, vat: totalVAT });
  }
  breakdown.sort((a, b) => a.rate - b.rate);
  invoice.vatBreakdown = breakdown as typeof invoice.vatBreakdown;

  if (invoice.status !== "cancelled") {
    invoice.status = balanceDue === 0 ? "paid" : paidTotal > 0 ? "partially_paid" : invoice.status;
  }

  await invoice.save();
}
