import type { DiscountAppliesTo, DiscountType } from "./discount-codes.js";
import { computeTtcCents } from "./money.js";
import type { BookingPriceLine, BookingPriceResponse, BookingVatBreakdownLine } from "./booking.js";

export interface BookingPriceLineInput {
  label: string;
  kind: "space" | "service";
  refId: string;
  serviceKey?: string;
  qty: number;
  unitPriceHT: number;
  vatRate: number;
}

export interface BookingDiscountInput {
  code: string;
  discountType: DiscountType;
  value: number;
  perimeter: {
    appliesTo: DiscountAppliesTo;
    serviceKeys?: string[];
  };
}

export interface ComputeBookingPriceInput {
  lines: BookingPriceLineInput[];
  discount?: BookingDiscountInput;
}

interface MutableBookingLine extends BookingPriceLineInput {
  lineHT: number;
  discount: number;
}

function lineGrossHT(line: BookingPriceLineInput): number {
  return line.qty * line.unitPriceHT;
}

function getDiscountableLines(
  lines: readonly MutableBookingLine[],
  discount: BookingDiscountInput,
): MutableBookingLine[] {
  if (discount.discountType === "buy_one_get_one") {
    const keys = new Set(discount.perimeter.serviceKeys ?? []);
    return lines.filter(
      (line) => line.kind === "service" && line.serviceKey != null && keys.has(line.serviceKey),
    );
  }

  if (discount.perimeter.appliesTo === "order") {
    return [...lines];
  }

  if (discount.perimeter.appliesTo === "service") {
    const keys = new Set(discount.perimeter.serviceKeys ?? []);
    return lines.filter(
      (line) => line.kind === "service" && line.serviceKey != null && keys.has(line.serviceKey),
    );
  }

  return [];
}

function allocateProportionalDiscount(
  discountableLines: readonly MutableBookingLine[],
  discountTotal: number,
): void {
  if (discountTotal <= 0 || discountableLines.length === 0) {
    return;
  }

  const discountBase = discountableLines.reduce((sum, line) => sum + line.lineHT, 0);
  if (discountBase <= 0) {
    return;
  }

  let allocated = 0;
  for (let index = 0; index < discountableLines.length; index += 1) {
    const line = discountableLines[index]!;
    const isLast = index === discountableLines.length - 1;
    const share = isLast
      ? discountTotal - allocated
      : Math.round((line.lineHT * discountTotal) / discountBase);
    line.discount = share;
    allocated += share;
  }
}

function applyBuyOneGetOneDiscount(
  lines: readonly MutableBookingLine[],
  serviceKeys: readonly string[],
): number {
  const keys = new Set(serviceKeys);
  let discountTotal = 0;

  for (const line of lines) {
    if (line.kind !== "service" || line.serviceKey == null || !keys.has(line.serviceKey)) {
      continue;
    }

    const freeUnits = Math.floor(line.qty / 2);
    line.discount = freeUnits * line.unitPriceHT;
    discountTotal += line.discount;
  }

  return discountTotal;
}

function computeDiscountTotal(
  lines: readonly MutableBookingLine[],
  discount: BookingDiscountInput,
): number {
  if (discount.discountType === "buy_one_get_one") {
    return applyBuyOneGetOneDiscount(lines, discount.perimeter.serviceKeys ?? []);
  }

  const discountableLines = getDiscountableLines(lines, discount);
  const discountBase = discountableLines.reduce((sum, line) => sum + line.lineHT, 0);
  if (discountBase <= 0) {
    return 0;
  }

  let discountTotal = 0;
  if (discount.discountType === "percentage") {
    discountTotal = Math.round((discountBase * discount.value) / 100);
  } else if (discount.discountType === "fixed_amount") {
    discountTotal = Math.min(discount.value, discountBase);
  }

  allocateProportionalDiscount(discountableLines, discountTotal);
  return discountTotal;
}

function finalizeLine(line: MutableBookingLine): BookingPriceLine {
  const totalHT = line.lineHT - line.discount;
  const totalTTC = computeTtcCents(totalHT, line.vatRate);
  const totalVAT = totalTTC - totalHT;

  return {
    label: line.label,
    kind: line.kind,
    refId: line.refId,
    qty: line.qty,
    unitPriceHT: line.unitPriceHT,
    vatRate: line.vatRate,
    discount: line.discount,
    totalHT,
    totalVAT,
    totalTTC,
  };
}

function computeVatBreakdown(lines: readonly BookingPriceLine[]): BookingVatBreakdownLine[] {
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
    .sort(([leftRate], [rightRate]) => leftRate - rightRate)
    .map(([rate, totals]) => ({
      rate,
      baseHT: totals.baseHT,
      vat: totals.vat,
    }));
}

export function computeBookingPrice(input: ComputeBookingPriceInput): BookingPriceResponse {
  const mutableLines: MutableBookingLine[] = input.lines.map((line) => ({
    ...line,
    lineHT: lineGrossHT(line),
    discount: 0,
  }));

  const subtotalHT = mutableLines.reduce((sum, line) => sum + line.lineHT, 0);
  const discountTotal = input.discount ? computeDiscountTotal(mutableLines, input.discount) : 0;
  const lines = mutableLines.map(finalizeLine);
  const vatBreakdown = computeVatBreakdown(lines);
  const totalTTC = lines.reduce((sum, line) => sum + line.totalTTC, 0);

  return {
    subtotalHT,
    discountTotal,
    vatBreakdown,
    totalTTC,
    lines,
    discount: input.discount
      ? {
          code: input.discount.code,
          label: input.discount.code,
          type: input.discount.discountType,
        }
      : undefined,
  };
}
