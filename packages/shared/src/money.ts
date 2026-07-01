/** Converts a euro amount (max 2 decimal places) to integer centimes without float drift. */
export function eurosToCents(euros: number): number {
  if (!Number.isFinite(euros) || euros < 0) {
    throw new RangeError("Invalid euro amount");
  }

  const parts = euros.toFixed(2).split(".");
  const wholePart = parts[0] ?? "0";
  const fractionPart = parts[1] ?? "";
  const whole = Number.parseInt(wholePart, 10);
  const fraction = Number.parseInt(fractionPart.padEnd(2, "0").slice(0, 2), 10);
  return whole * 100 + fraction;
}

/** Converts integer centimes back to euros for display or round-trip checks. */
export function centsToEuros(cents: number): number {
  if (!Number.isInteger(cents)) {
    throw new RangeError("Cents must be an integer");
  }

  const sign = cents < 0 ? -1 : 1;
  const abs = Math.abs(cents);
  return sign * (Math.trunc(abs / 100) + (abs % 100) / 100);
}

/** Formats centimes as a fixed 2-decimal euro string (e.g. 1999 → "19.99"). */
export function formatCentsAsEuroString(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new RangeError("Cents must be an integer");
  }

  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = Math.trunc(abs / 100);
  const fraction = abs % 100;
  return `${sign}${euros}.${String(fraction).padStart(2, "0")}`;
}

export function isValidEuroAmount(euros: number): boolean {
  if (!Number.isFinite(euros) || euros < 0) {
    return false;
  }
  const scaled = euros * 100;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
}

/** Indicative TTC in centimes (integer rounding). */
export function computeTtcCents(priceHTCents: number, vatRate: number): number {
  if (!Number.isInteger(priceHTCents) || priceHTCents < 0) {
    throw new RangeError("priceHT must be a non-negative integer");
  }
  if (!Number.isFinite(vatRate) || vatRate < 0) {
    throw new RangeError("Invalid VAT rate");
  }
  return Math.round((priceHTCents * (100 + vatRate)) / 100);
}
