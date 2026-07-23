import type {
  QuotePaymentMethod,
  QuotePaymentSituation,
  QuoteProspect,
  ServiceCustomAnswer,
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
  /** Draft answers keyed by custom question id (booking-style). */
  answerValues?: Record<string, unknown>;
  customAnswers?: ServiceCustomAnswer[];
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
    phone: "",
    clientKind: "individual",
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

export function deriveProspectDisplayName(prospect: QuoteProspect): string | undefined {
  const first = prospect.firstName?.trim();
  const last = prospect.lastName?.trim();
  if (first && last) return `${first} ${last}`;
  const legacy = prospect.displayName?.trim();
  return legacy || undefined;
}

export function prospectForApi(prospect: QuoteProspect): QuoteProspect | undefined {
  const email = prospect.email.trim().toLowerCase();
  if (!email) return undefined;
  const firstName = prospect.firstName?.trim();
  const lastName = prospect.lastName?.trim();
  const displayName = deriveProspectDisplayName(prospect);
  const address = prospect.billingAddress;
  const hasAddress = Boolean(
    address?.street?.trim() && address.zip?.trim() && address.city?.trim(),
  );
  const siretDigits = prospect.siret?.replaceAll(/\D/g, "") || undefined;
  return {
    email,
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(displayName ? { displayName } : {}),
    ...(prospect.phone?.trim() ? { phone: prospect.phone.trim() } : {}),
    ...(prospect.clientKind ? { clientKind: prospect.clientKind } : {}),
    ...(prospect.companyName?.trim() ? { companyName: prospect.companyName.trim() } : {}),
    ...(siretDigits ? { siret: siretDigits } : {}),
    ...(prospect.vatNumber?.trim() ? { vatNumber: prospect.vatNumber.trim() } : {}),
    ...(hasAddress && address
      ? {
          billingAddress: {
            street: address.street.trim(),
            zip: address.zip.trim(),
            city: address.city.trim(),
            country: (address.country?.trim() || "FR").toUpperCase(),
            ...(address.accessInfo?.trim() ? { accessInfo: address.accessInfo.trim() } : {}),
          },
        }
      : {}),
  };
}

/** Client step gate before advancing / saving. */
export function validateClientStep(input: {
  cardexId: string;
  clientAccountId: string;
  prospect: QuoteProspect;
}): string | null {
  if (input.cardexId && input.clientAccountId) {
    return null;
  }
  if (!input.prospect.email.trim()) {
    return "L’email client est requis.";
  }
  if (!input.prospect.firstName?.trim() || !input.prospect.lastName?.trim()) {
    return "Le prénom et le nom sont requis.";
  }
  const address = input.prospect.billingAddress;
  if (!address?.street?.trim() || !address.zip?.trim() || !address.city?.trim()) {
    return "L’adresse de facturation est requise.";
  }
  if (input.prospect.clientKind === "company") {
    if (!input.prospect.companyName?.trim()) {
      return "La raison sociale est requise pour un professionnel.";
    }
    const siret = input.prospect.siret?.replaceAll(/\D/g, "") ?? "";
    if (!/^\d{14}$/.test(siret)) {
      return "Le SIRET (14 chiffres) est requis pour un professionnel.";
    }
  }
  return null;
}
