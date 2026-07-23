import { describe, expect, it } from "vitest";

import {
  applyQuoteLinePricing,
  computeHtFromTtcCents,
  computeQuoteDeposit,
  computeQuoteTotals,
  computeQuoteVatBreakdown,
  recomputeQuotePricing,
} from "./billing-quote-pricing.js";
import { computeTtcCents } from "./money.js";

describe("applyQuoteLinePricing", () => {
  it("keeps calculated* and uses auto unit price", () => {
    const result = applyQuoteLinePricing({
      calculatedUnitPriceHT: 10_000,
      qty: 2,
      vatRate: 20,
    });
    expect(result.priceSource).toBe("auto");
    expect(result.unitPriceHT).toBe(10_000);
    expect(result.calculatedUnitPriceHT).toBe(10_000);
    expect(result.totalHT).toBe(20_000);
    expect(result.totalTTC).toBe(24_000);
    expect(result.totalVAT).toBe(4_000);
    expect(result.calculatedTotalHT).toBe(20_000);
    expect(result.calculatedTotalTTC).toBe(24_000);
  });

  it("applies forced unit price while preserving calculated*", () => {
    const result = applyQuoteLinePricing({
      calculatedUnitPriceHT: 10_000,
      forcedUnitPriceHT: 8_000,
      priceSource: "forced",
      qty: 2,
      vatRate: 20,
    });
    expect(result.priceSource).toBe("forced");
    expect(result.unitPriceHT).toBe(8_000);
    expect(result.forcedUnitPriceHT).toBe(8_000);
    expect(result.totalHT).toBe(16_000);
    expect(result.totalTTC).toBe(19_200);
    expect(result.calculatedTotalHT).toBe(20_000);
    expect(result.calculatedTotalTTC).toBe(24_000);
  });

  it("subtracts discount in cents before VAT", () => {
    const result = applyQuoteLinePricing({
      calculatedUnitPriceHT: 10_000,
      qty: 1,
      vatRate: 20,
      discount: 1_000,
    });
    expect(result.totalHT).toBe(9_000);
    expect(result.totalTTC).toBe(10_800);
  });

  it("rejects forced without forcedUnitPriceHT", () => {
    expect(() =>
      applyQuoteLinePricing({
        calculatedUnitPriceHT: 1000,
        qty: 1,
        vatRate: 20,
        priceSource: "forced",
      }),
    ).toThrow(/forcedUnitPriceHT/);
  });
});

describe("computeHtFromTtcCents", () => {
  it("round-trips with computeTtcCents for common rates", () => {
    for (const ht of [0, 1, 1999, 10_000, 90_000]) {
      for (const rate of [0, 5.5, 10, 20]) {
        const ttc = computeTtcCents(ht, rate);
        const back = computeHtFromTtcCents(ttc, rate);
        expect(computeTtcCents(back, rate)).toBe(ttc);
      }
    }
  });
});

describe("computeQuoteVatBreakdown + totals", () => {
  it("groups multi-rate lines and sums totals in integer cents", () => {
    const lines = [
      applyQuoteLinePricing({ calculatedUnitPriceHT: 10_000, qty: 1, vatRate: 20 }),
      applyQuoteLinePricing({ calculatedUnitPriceHT: 5_000, qty: 1, vatRate: 10 }),
    ];
    expect(computeQuoteVatBreakdown(lines)).toEqual([
      { rate: 10, baseHT: 5_000, vat: 500 },
      { rate: 20, baseHT: 10_000, vat: 2_000 },
    ]);
    expect(computeQuoteTotals(lines)).toEqual({
      ht: 15_000,
      vat: 2_500,
      ttc: 17_500,
      discountTotal: 0,
    });
  });
});

describe("computeQuoteDeposit (TVA acompte)", () => {
  const dualVat = [
    { rate: 10, baseHT: 5_000, vat: 500 },
    { rate: 20, baseHT: 10_000, vat: 2_000 },
  ];
  const totalsTtc = 17_500;

  it("returns zeros for 0% deposit", () => {
    expect(computeQuoteDeposit({ depositPercent: 0, totalsTtc, vatBreakdown: dualVat })).toEqual({
      depositPercent: 0,
      depositAmountTTC: 0,
      depositAmountHT: 0,
      depositVatBreakdown: [],
    });
  });

  it("at 100% matches full TTC and reconstructs HT/VAT per rate", () => {
    const result = computeQuoteDeposit({
      depositPercent: 100,
      totalsTtc,
      vatBreakdown: dualVat,
    });
    expect(result.depositAmountTTC).toBe(17_500);
    const sumTtc = result.depositVatBreakdown.reduce((s, r) => s + r.baseHT + r.vat, 0);
    expect(sumTtc).toBe(17_500);
    expect(result.depositAmountHT).toBe(
      result.depositVatBreakdown.reduce((s, r) => s + r.baseHT, 0),
    );
    expect(result.depositVatBreakdown).toHaveLength(2);
  });

  it("at 30% allocates TTC prorata across rates without float drift", () => {
    const result = computeQuoteDeposit({
      depositPercent: 30,
      totalsTtc,
      vatBreakdown: dualVat,
    });
    // 30% of 17500 = 5250
    expect(result.depositAmountTTC).toBe(5_250);
    const sumTtc = result.depositVatBreakdown.reduce((s, r) => s + r.baseHT + r.vat, 0);
    expect(sumTtc).toBe(5_250);
    expect(result.depositAmountHT + result.depositVatBreakdown.reduce((s, r) => s + r.vat, 0)).toBe(
      5_250,
    );
    // Weights: 10% bucket TTC=5500, 20% bucket TTC=12000
    // share10 = round(5500*5250/17500)=1650; share20 = 5250-1650=3600
    expect(result.depositVatBreakdown).toEqual([
      {
        rate: 10,
        baseHT: computeHtFromTtcCents(1_650, 10),
        vat: 1_650 - computeHtFromTtcCents(1_650, 10),
      },
      {
        rate: 20,
        baseHT: computeHtFromTtcCents(3_600, 20),
        vat: 3_600 - computeHtFromTtcCents(3_600, 20),
      },
    ]);
  });

  it("single VAT rate deposit is a simple percent of TTC", () => {
    const result = computeQuoteDeposit({
      depositPercent: 40,
      totalsTtc: 12_000,
      vatBreakdown: [{ rate: 20, baseHT: 10_000, vat: 2_000 }],
    });
    expect(result.depositAmountTTC).toBe(4_800);
    expect(result.depositVatBreakdown).toEqual([
      {
        rate: 20,
        baseHT: computeHtFromTtcCents(4_800, 20),
        vat: 4_800 - computeHtFromTtcCents(4_800, 20),
      },
    ]);
    expect(result.depositAmountHT).toBe(computeHtFromTtcCents(4_800, 20));
  });
});

describe("recomputeQuotePricing", () => {
  it("wires forced lines + deposit end-to-end", () => {
    const result = recomputeQuotePricing({
      depositPercent: 50,
      lines: [
        {
          calculatedUnitPriceHT: 10_000,
          forcedUnitPriceHT: 8_000,
          priceSource: "forced",
          qty: 1,
          vatRate: 20,
        },
        { calculatedUnitPriceHT: 5_000, qty: 1, vatRate: 10 },
      ],
    });
    // forced 8000 HT @20% → 9600 TTC; auto 5000 HT @10% → 5500 TTC
    expect(result.totals.ttc).toBe(15_100);
    expect(result.deposit.depositAmountTTC).toBe(Math.round((15_100 * 50) / 100));
    expect(result.deposit.depositVatBreakdown.reduce((s, r) => s + r.baseHT + r.vat, 0)).toBe(
      result.deposit.depositAmountTTC,
    );
    expect(result.lines[0]?.calculatedTotalHT).toBe(10_000);
    expect(result.lines[0]?.totalHT).toBe(8_000);
  });
});
