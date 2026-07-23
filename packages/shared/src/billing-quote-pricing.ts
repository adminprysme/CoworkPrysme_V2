import { computeTtcCents } from "./money.js";

/**
 * Quote line pricing override + deposit engine (+ TVA acompte).
 *
 * Deposit VAT method (LOCKED #4 — French acompte invoice):
 * 1. `depositAmountTTC = round(totals.ttc * depositPercent / 100)`
 * 2. Allocate that TTC across VAT rates **proportionally to each rate's TTC share**
 *    (`rateTTC = baseHT + vat` from the quote `vatBreakdown`), last bucket gets remainder.
 * 3. For each rate slice: `baseHT = round(ttc * 100 / (100 + rate))`, `vat = ttc - baseHT`
 *    (inverse of `computeTtcCents`).
 * 4. `depositAmountHT = sum(baseHT)`; do **not** invent a fake “acompte” line in `lines`.
 */

export interface QuoteVatBreakdownLine {
  rate: number;
  baseHT: number;
  vat: number;
}

export interface QuoteLinePricingInput {
  calculatedUnitPriceHT: number;
  qty: number;
  vatRate: number;
  /** Cents; default 0. */
  discount?: number;
  /** When set with priceSource "forced" (or alone), becomes effective unit price. */
  forcedUnitPriceHT?: number;
  priceSource?: "auto" | "forced";
}

export interface AppliedQuoteLinePricing {
  priceSource: "auto" | "forced";
  qty: number;
  vatRate: number;
  discount: number;
  calculatedUnitPriceHT: number;
  calculatedTotalHT: number;
  calculatedTotalVAT: number;
  calculatedTotalTTC: number;
  forcedUnitPriceHT?: number;
  unitPriceHT: number;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
}

export interface QuoteLineTotalsInput {
  vatRate: number;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  discount?: number;
  /** Discount kind lines are excluded from VAT aggregation (booking parity). */
  kind?: string;
}

export interface QuoteBillingTotals {
  ht: number;
  vat: number;
  ttc: number;
  discountTotal: number;
}

export interface QuoteDepositResult {
  depositPercent: number;
  depositAmountTTC: number;
  depositAmountHT: number;
  depositVatBreakdown: QuoteVatBreakdownLine[];
}

export interface RecomputeQuotePricingInput {
  lines: readonly QuoteLinePricingInput[];
  depositPercent: number;
}

export interface RecomputeQuotePricingResult {
  lines: AppliedQuoteLinePricing[];
  vatBreakdown: QuoteVatBreakdownLine[];
  totals: QuoteBillingTotals;
  deposit: QuoteDepositResult;
}

/** HT cents from TTC + rate (integer rounding; inverse of computeTtcCents). */
export function computeHtFromTtcCents(ttcCents: number, vatRate: number): number {
  if (!Number.isInteger(ttcCents) || ttcCents < 0) {
    throw new RangeError("ttcCents must be a non-negative integer");
  }
  if (!Number.isFinite(vatRate) || vatRate < 0) {
    throw new RangeError("Invalid VAT rate");
  }
  if (vatRate === 0) {
    return ttcCents;
  }
  return Math.round((ttcCents * 100) / (100 + vatRate));
}

function lineAmountsFromUnit(
  unitPriceHT: number,
  qty: number,
  vatRate: number,
  discount: number,
): { totalHT: number; totalVAT: number; totalTTC: number } {
  const grossHT = qty * unitPriceHT;
  const totalHT = Math.max(0, grossHT - discount);
  const totalTTC = computeTtcCents(totalHT, vatRate);
  const totalVAT = totalTTC - totalHT;
  return { totalHT, totalVAT, totalTTC };
}

/**
 * Resolves effective unit price (auto vs forced) and recomputes line HT/VAT/TTC.
 * Always preserves `calculated*` from `calculatedUnitPriceHT`.
 */
export function applyQuoteLinePricing(input: QuoteLinePricingInput): AppliedQuoteLinePricing {
  if (!Number.isInteger(input.calculatedUnitPriceHT) || input.calculatedUnitPriceHT < 0) {
    throw new RangeError("calculatedUnitPriceHT must be a non-negative integer");
  }
  if (!Number.isFinite(input.qty) || input.qty < 0) {
    throw new RangeError("qty must be a non-negative number");
  }
  if (!Number.isFinite(input.vatRate) || input.vatRate < 0) {
    throw new RangeError("Invalid VAT rate");
  }

  const discount = input.discount ?? 0;
  if (!Number.isInteger(discount) || discount < 0) {
    throw new RangeError("discount must be a non-negative integer");
  }

  const calculated = lineAmountsFromUnit(
    input.calculatedUnitPriceHT,
    input.qty,
    input.vatRate,
    discount,
  );

  const wantsForced =
    input.priceSource === "forced" ||
    (input.forcedUnitPriceHT !== undefined && input.priceSource !== "auto");

  if (wantsForced) {
    if (input.forcedUnitPriceHT === undefined) {
      throw new RangeError("forcedUnitPriceHT is required when priceSource is forced");
    }
    if (!Number.isInteger(input.forcedUnitPriceHT) || input.forcedUnitPriceHT < 0) {
      throw new RangeError("forcedUnitPriceHT must be a non-negative integer");
    }
    const effective = lineAmountsFromUnit(
      input.forcedUnitPriceHT,
      input.qty,
      input.vatRate,
      discount,
    );
    return {
      priceSource: "forced",
      qty: input.qty,
      vatRate: input.vatRate,
      discount,
      calculatedUnitPriceHT: input.calculatedUnitPriceHT,
      calculatedTotalHT: calculated.totalHT,
      calculatedTotalVAT: calculated.totalVAT,
      calculatedTotalTTC: calculated.totalTTC,
      forcedUnitPriceHT: input.forcedUnitPriceHT,
      unitPriceHT: input.forcedUnitPriceHT,
      totalHT: effective.totalHT,
      totalVAT: effective.totalVAT,
      totalTTC: effective.totalTTC,
    };
  }

  return {
    priceSource: "auto",
    qty: input.qty,
    vatRate: input.vatRate,
    discount,
    calculatedUnitPriceHT: input.calculatedUnitPriceHT,
    calculatedTotalHT: calculated.totalHT,
    calculatedTotalVAT: calculated.totalVAT,
    calculatedTotalTTC: calculated.totalTTC,
    unitPriceHT: input.calculatedUnitPriceHT,
    totalHT: calculated.totalHT,
    totalVAT: calculated.totalVAT,
    totalTTC: calculated.totalTTC,
  };
}

/** Aggregates effective line totals by VAT rate (sorted ascending). */
export function computeQuoteVatBreakdown(
  lines: readonly QuoteLineTotalsInput[],
): QuoteVatBreakdownLine[] {
  const grouped = new Map<number, { baseHT: number; vat: number }>();

  for (const line of lines) {
    if (line.kind === "discount") {
      continue;
    }
    const current = grouped.get(line.vatRate) ?? { baseHT: 0, vat: 0 };
    current.baseHT += line.totalHT;
    current.vat += line.totalVAT;
    grouped.set(line.vatRate, current);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([rate, totals]) => ({
      rate,
      baseHT: totals.baseHT,
      vat: totals.vat,
    }));
}

export function computeQuoteTotals(lines: readonly QuoteLineTotalsInput[]): QuoteBillingTotals {
  let ht = 0;
  let vat = 0;
  let ttc = 0;
  let discountTotal = 0;
  for (const line of lines) {
    ht += line.totalHT;
    vat += line.totalVAT;
    ttc += line.totalTTC;
    discountTotal += line.discount ?? 0;
  }
  return { ht, vat, ttc, discountTotal };
}

/** Allocate `total` cents across weights; last non-zero-weight bucket absorbs remainder. */
function allocateProportionalCents(weights: readonly number[], total: number): number[] {
  const n = weights.length;
  if (n === 0 || total <= 0) {
    return Array.from({ length: n }, () => 0);
  }
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (weightSum <= 0) {
    return Array.from({ length: n }, () => 0);
  }

  const shares = Array.from({ length: n }, () => 0);
  let allocated = 0;
  let lastIndex = -1;
  for (let i = 0; i < n; i += 1) {
    if (weights[i]! > 0) {
      lastIndex = i;
    }
  }
  if (lastIndex < 0) {
    return shares;
  }

  for (let i = 0; i < n; i += 1) {
    if (i === lastIndex) {
      shares[i] = total - allocated;
    } else if (weights[i]! > 0) {
      const share = Math.round((weights[i]! * total) / weightSum);
      shares[i] = share;
      allocated += share;
    }
  }
  return shares;
}

/**
 * Derives deposit TTC/HT and per-rate VAT breakdown from quote totals + vatBreakdown.
 * @see file header for the locked proportional method.
 */
export function computeQuoteDeposit(input: {
  depositPercent: number;
  totalsTtc: number;
  vatBreakdown: readonly QuoteVatBreakdownLine[];
}): QuoteDepositResult {
  const { depositPercent, totalsTtc } = input;
  if (!Number.isInteger(depositPercent) || depositPercent < 0 || depositPercent > 100) {
    throw new RangeError("depositPercent must be an integer 0–100");
  }
  if (!Number.isInteger(totalsTtc) || totalsTtc < 0) {
    throw new RangeError("totalsTtc must be a non-negative integer");
  }

  if (depositPercent === 0 || totalsTtc === 0) {
    return {
      depositPercent,
      depositAmountTTC: 0,
      depositAmountHT: 0,
      depositVatBreakdown: [],
    };
  }

  const depositAmountTTC = Math.round((totalsTtc * depositPercent) / 100);
  if (depositAmountTTC === 0) {
    return {
      depositPercent,
      depositAmountTTC: 0,
      depositAmountHT: 0,
      depositVatBreakdown: [],
    };
  }

  const rates = input.vatBreakdown.map((row) => row.rate);
  const weights = input.vatBreakdown.map((row) => row.baseHT + row.vat);
  const ttcShares = allocateProportionalCents(weights, depositAmountTTC);

  const depositVatBreakdown: QuoteVatBreakdownLine[] = [];
  let depositAmountHT = 0;

  for (let i = 0; i < rates.length; i += 1) {
    const ttcShare = ttcShares[i]!;
    if (ttcShare <= 0) {
      continue;
    }
    const rate = rates[i]!;
    const baseHT = computeHtFromTtcCents(ttcShare, rate);
    const vat = ttcShare - baseHT;
    depositAmountHT += baseHT;
    depositVatBreakdown.push({ rate, baseHT, vat });
  }

  return {
    depositPercent,
    depositAmountTTC,
    depositAmountHT,
    depositVatBreakdown,
  };
}

/** Full recompute: line pricing → vatBreakdown → totals → deposit. */
export function recomputeQuotePricing(
  input: RecomputeQuotePricingInput,
): RecomputeQuotePricingResult {
  const lines = input.lines.map((line) => applyQuoteLinePricing(line));
  const vatBreakdown = computeQuoteVatBreakdown(lines);
  const totals = computeQuoteTotals(lines);
  const deposit = computeQuoteDeposit({
    depositPercent: input.depositPercent,
    totalsTtc: totals.ttc,
    vatBreakdown,
  });
  return { lines, vatBreakdown, totals, deposit };
}
