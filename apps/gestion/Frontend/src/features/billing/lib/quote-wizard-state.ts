import type {
  QuotePaymentMethod,
  QuotePaymentSituation,
  QuoteProspect,
  ServiceResponse,
  SpaceResponse,
  StaffQuoteLineInput,
} from "@coworkprysme/shared";
import { resolveSpaceStayPricing } from "@coworkprysme/shared";

export const QUOTE_WIZARD_STEPS = [
  { id: "client", label: "Client" },
  { id: "spaces", label: "Espaces" },
  { id: "services", label: "Services" },
  { id: "pricing", label: "Tarification" },
  { id: "conditions", label: "Conditions" },
  { id: "recap", label: "Récap" },
] as const;

export type QuoteWizardStepId = (typeof QUOTE_WIZARD_STEPS)[number]["id"];

export type WizardSpaceSlot = {
  key: string;
  buildingId: string;
  spaceId: string;
  spaceName: string;
  startLocal: string;
  endLocal: string;
  partySize: number;
  available?: boolean;
  availabilityReason?: string;
};

export type WizardServicePick = {
  serviceId: string;
  label: string;
  priceHTCents: number;
  vatRate: number;
  qty: number;
};

export type WizardPricingOverride = {
  lineId: string;
  forcedUnitPriceHT: number;
  priceOverrideReason: string;
};

export type QuoteWizardState = {
  quoteId: string | null;
  reference: string | null;
  status: string | null;
  cardexId: string;
  clientAccountId: string;
  prospect: QuoteProspect;
  spaces: WizardSpaceSlot[];
  services: WizardServicePick[];
  overrides: WizardPricingOverride[];
  depositPercent: number;
  paymentSituation: QuotePaymentSituation | "";
  paymentMethodPreferred: QuotePaymentMethod | "";
  validUntilLocal: string;
  internalNote: string;
  publicConditions: string;
  paymentTermsLabel: string;
  locksExpiresAt: string | null;
};

export function createDefaultProspect(): QuoteProspect {
  return {
    email: "",
    firstName: "",
    lastName: "",
    displayName: "",
    phone: "",
    companyName: "",
  };
}

export function defaultValidUntilLocal(): string {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  date.setHours(23, 59, 0, 0);
  return toDatetimeLocalValue(date.toISOString());
}

export function createInitialWizardState(): QuoteWizardState {
  return {
    quoteId: null,
    reference: null,
    status: null,
    cardexId: "",
    clientAccountId: "",
    prospect: createDefaultProspect(),
    spaces: [],
    services: [],
    overrides: [],
    depositPercent: 0,
    paymentSituation: "",
    paymentMethodPreferred: "",
    validUntilLocal: defaultValidUntilLocal(),
    internalNote: "",
    publicConditions: "",
    paymentTermsLabel: "",
    locksExpiresAt: null,
  };
}

export function newSlotKey(): string {
  return `slot-${crypto.randomUUID()}`;
}

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(local: string): string | null {
  if (!local.trim()) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function formatEuroFromCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

export function buildQuoteLines(input: {
  spaces: WizardSpaceSlot[];
  spaceCatalog: Map<string, SpaceResponse>;
  services: WizardServicePick[];
  serviceCatalog: Map<string, ServiceResponse>;
  overrides: WizardPricingOverride[];
}): StaffQuoteLineInput[] {
  const overrideByLine = new Map(input.overrides.map((item) => [item.lineId, item]));
  const lines: StaffQuoteLineInput[] = [];

  for (const slot of input.spaces) {
    if (!slot.spaceId || !slot.startLocal || !slot.endLocal) continue;
    const space = input.spaceCatalog.get(slot.spaceId);
    if (!space) continue;
    const startAt = fromDatetimeLocalValue(slot.startLocal);
    const endAt = fromDatetimeLocalValue(slot.endLocal);
    if (!startAt || !endAt) continue;

    let pricing;
    try {
      pricing = resolveSpaceStayPricing({
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        tariffs: space.tariffs.map((tariff) => ({
          durationClass: tariff.durationClass,
          priceHT: tariff.priceHT,
          vatRate: tariff.vatRate,
        })),
      });
    } catch {
      continue;
    }

    const lineId = `space-${slot.key}`;
    const override = overrideByLine.get(lineId);
    lines.push({
      lineId,
      kind: "space",
      label: `${space.name} (${pricing.durationClass} × ${pricing.units})`,
      spaceId: space.id,
      buildingId: space.buildingId,
      startAt,
      endAt,
      partySize: slot.partySize,
      durationClass: pricing.durationClass,
      units: pricing.units,
      calculatedUnitPriceHT: pricing.unitPriceHT,
      qty: pricing.units,
      vatRate: pricing.vatRate,
      ...(override
        ? {
            priceSource: "forced" as const,
            forcedUnitPriceHT: override.forcedUnitPriceHT,
            priceOverrideReason: override.priceOverrideReason,
          }
        : { priceSource: "auto" as const }),
    });
  }

  for (const pick of input.services) {
    const service = input.serviceCatalog.get(pick.serviceId) ?? {
      id: pick.serviceId,
      label: pick.label,
      priceHTCents: pick.priceHTCents,
      vatRate: pick.vatRate,
    };
    const lineId = `service-${pick.serviceId}`;
    const override = overrideByLine.get(lineId);
    lines.push({
      lineId,
      kind: "service",
      label: service.label,
      calculatedUnitPriceHT: service.priceHTCents,
      qty: pick.qty,
      vatRate: service.vatRate,
      ...(override
        ? {
            priceSource: "forced" as const,
            forcedUnitPriceHT: override.forcedUnitPriceHT,
            priceOverrideReason: override.priceOverrideReason,
          }
        : { priceSource: "auto" as const }),
    });
  }

  return lines;
}

export function prospectForApi(prospect: QuoteProspect): QuoteProspect | undefined {
  const email = prospect.email.trim().toLowerCase();
  if (!email) return undefined;
  return {
    email,
    ...(prospect.firstName?.trim() ? { firstName: prospect.firstName.trim() } : {}),
    ...(prospect.lastName?.trim() ? { lastName: prospect.lastName.trim() } : {}),
    ...(prospect.displayName?.trim() ? { displayName: prospect.displayName.trim() } : {}),
    ...(prospect.phone?.trim() ? { phone: prospect.phone.trim() } : {}),
    ...(prospect.companyName?.trim() ? { companyName: prospect.companyName.trim() } : {}),
    ...(prospect.billingAddress ? { billingAddress: prospect.billingAddress } : {}),
  };
}
