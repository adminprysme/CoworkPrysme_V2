import type { Address } from "@coworkprysme/db";
import { formatAvailabilityWindow } from "@coworkprysme/shared";

import type { InvoiceIssuerConfig } from "./invoice-issuer.config.js";
import type { InvoicePdfBankRibView, InvoicePdfClientView } from "./invoice-pdf.types.js";
import type {
  QuotePdfLineView,
  QuotePdfPaymentMethod,
  QuotePdfViewModel,
} from "./quote-pdf.types.js";

/** Source fields for devis PDF — may include staff-only keys that MUST be ignored. */
export interface QuotePdfSourceQuote {
  reference: string;
  issuedAt?: Date | string | null;
  validUntil: Date | string;
  lines: Array<{
    label: string;
    kind?: string;
    qty: number;
    unitPriceHT: number;
    vatRate: number;
    discount?: number;
    totalHT: number;
    startAt?: Date | string | null;
    endAt?: Date | string | null;
  }>;
  vatBreakdown: Array<{ rate: number; baseHT: number; vat: number }>;
  totals: {
    ht: number;
    vat: number;
    ttc: number;
    discountTotal?: number;
  };
  depositPercent?: number;
  depositAmountTTC?: number;
  paymentMethodPreferred?: string | null;
  paymentTermsLabel?: string | null;
  publicConditions?: string | null;
  /** Staff-only — must never be mapped into QuotePdfViewModel / PDF / email. */
  internalNote?: string | null;
  prospect?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    companyName?: string;
    siret?: string;
    vatNumber?: string;
    phone?: string;
    billingAddress?: Address | null;
  } | null;
}

export interface QuotePdfSourceCardex {
  identity: { firstName: string; lastName: string };
  address?: Address | null;
  company?: {
    legalName?: string;
    siret?: string;
    vatNumber?: string;
    billingAddress?: Address | null;
  } | null;
}

function asDate(value: Date | string | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function formatAddressLines(address?: Address | null): string[] {
  if (!address) return [];
  const locality = `${address.zip} ${address.city}`.trim();
  const lines = [address.street.trim(), locality];
  if (address.country && address.country !== "FR") {
    lines.push(address.country);
  }
  return lines.filter(Boolean);
}

function resolvePaymentMethod(raw: string | null | undefined): QuotePdfPaymentMethod {
  if (raw === "card" || raw === "bank_transfer" || raw === "direct_debit") return raw;
  return "unknown";
}

export function buildQuotePdfClientView(input: {
  prospect?: QuotePdfSourceQuote["prospect"];
  cardex?: QuotePdfSourceCardex | null;
}): InvoicePdfClientView {
  const prospect = input.prospect;
  if (prospect) {
    const companyName = prospect.companyName?.trim();
    if (companyName) {
      const secondary: string[] = [];
      if (prospect.siret?.trim()) secondary.push(`SIRET ${prospect.siret.trim()}`);
      if (prospect.vatNumber?.trim()) secondary.push(`TVA ${prospect.vatNumber.trim()}`);
      const person = `${prospect.firstName ?? ""} ${prospect.lastName ?? ""}`.trim();
      if (person) secondary.push(`Contact : ${person}`);
      if (prospect.email?.trim()) secondary.push(prospect.email.trim());
      return {
        displayName: companyName,
        secondaryLines: secondary,
        addressLines: formatAddressLines(prospect.billingAddress),
      };
    }
    const fromNames = `${prospect.firstName ?? ""} ${prospect.lastName ?? ""}`.trim();
    const displayName =
      prospect.displayName?.trim() || fromNames || prospect.email?.trim() || "Client";
    const secondary: string[] = [];
    if (prospect.email?.trim() && displayName !== prospect.email.trim()) {
      secondary.push(prospect.email.trim());
    }
    if (prospect.phone?.trim()) secondary.push(prospect.phone.trim());
    return {
      displayName,
      secondaryLines: secondary,
      addressLines: formatAddressLines(prospect.billingAddress),
    };
  }

  const cardex = input.cardex;
  if (cardex?.company?.legalName?.trim()) {
    const secondary: string[] = [];
    if (cardex.company.siret?.trim()) secondary.push(`SIRET ${cardex.company.siret.trim()}`);
    if (cardex.company.vatNumber?.trim()) secondary.push(`TVA ${cardex.company.vatNumber.trim()}`);
    const person = `${cardex.identity.firstName} ${cardex.identity.lastName}`.trim();
    if (person) secondary.push(`Contact : ${person}`);
    return {
      displayName: cardex.company.legalName.trim(),
      secondaryLines: secondary,
      addressLines: formatAddressLines(cardex.company.billingAddress ?? cardex.address),
    };
  }

  if (cardex) {
    return {
      displayName: `${cardex.identity.firstName} ${cardex.identity.lastName}`.trim(),
      secondaryLines: [],
      addressLines: formatAddressLines(cardex.address),
    };
  }

  return { displayName: "Client", secondaryLines: [], addressLines: [] };
}

export function buildQuotePdfLineViews(lines: QuotePdfSourceQuote["lines"]): QuotePdfLineView[] {
  return lines.map((line) => {
    const isSpace = line.kind === "space";
    const periodLabel =
      isSpace && line.startAt && line.endAt
        ? formatAvailabilityWindow(line.startAt, line.endAt)
        : undefined;
    return {
      label: line.label,
      kind: line.kind ?? "other",
      qty: line.qty,
      qtyOrPeriodLabel: isSpace && periodLabel ? periodLabel : String(line.qty),
      unitPriceHT: line.unitPriceHT,
      vatRate: line.vatRate,
      discount: line.discount ?? 0,
      totalHT: line.totalHT,
    };
  });
}

export function buildQuotePdfViewModel(input: {
  quote: QuotePdfSourceQuote;
  issuer: InvoiceIssuerConfig;
  logoDataUri: string;
  acceptUrl: string;
  cardex?: QuotePdfSourceCardex | null;
  bankRib?: InvoicePdfBankRibView | null;
  now?: Date;
}): QuotePdfViewModel {
  const now = input.now ?? new Date();
  const quote = input.quote;

  // Explicitly ignore staff-only fields — do not spread `quote` into the view model.
  void quote.internalNote;

  return {
    documentKindLabel: "DEVIS",
    quoteReference: quote.reference,
    issuedAt: asDate(quote.issuedAt, now),
    validUntil: asDate(quote.validUntil, now),
    issuer: input.issuer,
    client: buildQuotePdfClientView({ prospect: quote.prospect, cardex: input.cardex }),
    lines: buildQuotePdfLineViews(quote.lines),
    vatBreakdown: quote.vatBreakdown.map((row) => ({
      rate: row.rate,
      baseHT: row.baseHT,
      vat: row.vat,
    })),
    totals: {
      ht: quote.totals.ht,
      vat: quote.totals.vat,
      ttc: quote.totals.ttc,
      discountTotal: quote.totals.discountTotal ?? 0,
    },
    depositPercent: quote.depositPercent ?? 0,
    ...(quote.depositAmountTTC !== undefined ? { depositAmountTTC: quote.depositAmountTTC } : {}),
    paymentMethod: resolvePaymentMethod(quote.paymentMethodPreferred),
    ...(quote.paymentTermsLabel?.trim()
      ? { paymentTermsLabel: quote.paymentTermsLabel.trim() }
      : {}),
    ...(quote.publicConditions?.trim() ? { publicConditions: quote.publicConditions.trim() } : {}),
    acceptUrl: input.acceptUrl,
    bankRib: input.bankRib ?? null,
    logoDataUri: input.logoDataUri,
  };
}
