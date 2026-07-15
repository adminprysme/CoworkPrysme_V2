import { describe, expect, it } from "vitest";

import { computeBookingPrice, type BookingPriceLineInput } from "./booking-price.js";

const SPACE_LINE: BookingPriceLineInput = {
  label: "Salle Alpha",
  kind: "space",
  refId: "space-1",
  qty: 1,
  unitPriceHT: 10_000,
  vatRate: 20,
};

const COFFEE_LINE: BookingPriceLineInput = {
  label: "Café",
  kind: "service",
  refId: "service-coffee",
  serviceKey: "coffee",
  qty: 2,
  unitPriceHT: 500,
  vatRate: 20,
};

const PARKING_LINE: BookingPriceLineInput = {
  label: "Parking",
  kind: "service",
  refId: "service-parking",
  serviceKey: "parking",
  qty: 1,
  unitPriceHT: 800,
  vatRate: 10,
};

describe("computeBookingPrice discount bases", () => {
  it("never applies buy_one_get_one discount to the space line", () => {
    const result = computeBookingPrice({
      lines: [SPACE_LINE, COFFEE_LINE],
      discount: {
        code: "BOGOCAFE",
        discountType: "buy_one_get_one",
        value: 0,
        perimeter: { appliesTo: "service", serviceKeys: ["coffee"] },
      },
    });

    const spaceLine = result.lines.find((line) => line.kind === "space");
    const coffeeLine = result.lines.find((line) => line.refId === "service-coffee");

    expect(spaceLine?.discount).toBe(0);
    expect(coffeeLine?.discount).toBe(500);
    expect(result.discountTotal).toBe(500);
  });

  it("applies percentage order discounts to the space line as well", () => {
    const result = computeBookingPrice({
      lines: [SPACE_LINE, COFFEE_LINE],
      discount: {
        code: "CODE20",
        discountType: "percentage",
        value: 20,
        perimeter: { appliesTo: "order" },
      },
    });

    const spaceLine = result.lines.find((line) => line.kind === "space");
    const coffeeLine = result.lines.find((line) => line.refId === "service-coffee");

    expect(spaceLine?.discount).toBe(2_000);
    expect(coffeeLine?.discount).toBe(200);
    expect(result.discountTotal).toBe(2_200);
  });

  it("applies percentage service discounts only to targeted services", () => {
    const result = computeBookingPrice({
      lines: [SPACE_LINE, COFFEE_LINE, PARKING_LINE],
      discount: {
        code: "CAFE10",
        discountType: "percentage",
        value: 10,
        perimeter: { appliesTo: "service", serviceKeys: ["coffee"] },
      },
    });

    const spaceLine = result.lines.find((line) => line.kind === "space");
    const coffeeLine = result.lines.find((line) => line.refId === "service-coffee");
    const parkingLine = result.lines.find((line) => line.refId === "service-parking");

    expect(spaceLine?.discount).toBe(0);
    expect(coffeeLine?.discount).toBe(100);
    expect(parkingLine?.discount).toBe(0);
    expect(result.discountTotal).toBe(100);
  });
});

describe("computeBookingPrice VAT aggregation", () => {
  it("builds a multi-rate VAT breakdown for space and services", () => {
    const result = computeBookingPrice({
      lines: [SPACE_LINE, COFFEE_LINE, PARKING_LINE],
    });

    expect(result.subtotalHT).toBe(11_800);
    expect(result.vatBreakdown).toEqual([
      { rate: 10, baseHT: 800, vat: 80 },
      { rate: 20, baseHT: 11_000, vat: 2_200 },
    ]);
    expect(result.totalTTC).toBe(14_080);
  });
});

describe("computeBookingPrice fixed amount", () => {
  it("caps fixed order discounts to the discountable base", () => {
    const result = computeBookingPrice({
      lines: [COFFEE_LINE],
      discount: {
        code: "FIXED50",
        discountType: "fixed_amount",
        value: 5_000,
        perimeter: { appliesTo: "order" },
      },
    });

    expect(result.discountTotal).toBe(1_000);
    expect(result.lines[0]?.totalHT).toBe(0);
  });
});
