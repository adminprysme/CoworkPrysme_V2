import {
  DEFAULT_SPACE_TARIFF_VAT_RATE,
  DURATION_CLASS_LABELS,
  SPACE_DURATION_CLASSES,
  centsToEuros,
  computeTtcCents,
  eurosToCents,
  formatCentsAsEuroString,
  type SpaceDurationClass,
  type SpaceTariffInput,
  type SpaceTariffResponse,
} from "@coworkprysme/shared";

export interface SpaceTariffFormLine {
  durationClass: SpaceDurationClass;
  label: string;
  enabled: boolean;
  priceEuros: number;
  vatRate: number;
}

export function createDefaultTariffLines(): SpaceTariffFormLine[] {
  return SPACE_DURATION_CLASSES.map((durationClass) => ({
    durationClass,
    label: DURATION_CLASS_LABELS[durationClass],
    enabled: false,
    priceEuros: 0,
    vatRate: DEFAULT_SPACE_TARIFF_VAT_RATE,
  }));
}

export function tariffLinesToApiInput(lines: SpaceTariffFormLine[]): SpaceTariffInput[] {
  return lines.map((line) => ({
    durationClass: line.durationClass,
    priceEuros: line.enabled ? line.priceEuros : 0,
    vatRate: line.vatRate,
    enabled: line.enabled,
  }));
}

export function tariffResponseToFormLines(tariffs: SpaceTariffResponse[]): SpaceTariffFormLine[] {
  const byClass = new Map(tariffs.map((tariff) => [tariff.durationClass, tariff]));

  return SPACE_DURATION_CLASSES.map((durationClass) => {
    const existing = byClass.get(durationClass);
    return {
      durationClass,
      label: DURATION_CLASS_LABELS[durationClass],
      enabled: existing !== undefined,
      priceEuros: existing ? centsToEuros(existing.priceHT) : 0,
      vatRate: existing?.vatRate ?? DEFAULT_SPACE_TARIFF_VAT_RATE,
    };
  });
}

export function formatEuros(value: number): string {
  return value.toFixed(2);
}

export function formatTtcFromLine(line: SpaceTariffFormLine): string {
  if (!line.enabled) {
    return "—";
  }
  const ttcCents = computeTtcCents(eurosToCents(line.priceEuros), line.vatRate);
  return `${formatCentsAsEuroString(ttcCents)} €`;
}

export function formatTtcFromResponse(tariff: SpaceTariffResponse): string {
  const ttcCents = computeTtcCents(tariff.priceHT, tariff.vatRate);
  return `${formatCentsAsEuroString(ttcCents)} €`;
}
