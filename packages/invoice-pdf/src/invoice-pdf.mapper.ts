import type { Address, CardexCompany, CardexIdentity } from "@coworkprysme/db";
import { formatAvailabilityWindow } from "@coworkprysme/shared";

import type { InvoiceIssuerConfig } from "./invoice-issuer.config.js";
import type {
  InvoicePdfBankRibView,
  InvoicePdfClientView,
  InvoicePdfLineView,
  InvoicePdfPaymentMethod,
  InvoicePdfPaymentStatus,
  InvoicePdfViewModel,
} from "./invoice-pdf.types.js";

export interface InvoicePdfSourceInvoice {
  reference: string;
  type: string;
  status: string;
  issuedAt?: Date | string | null;
  dueDate?: Date | string | null;
  paidAt?: Date | string | null;
  lines: Array<{
    label: string;
    kind?: string;
    qty: number;
    unitPriceHT: number;
    vatRate: number;
    discount: number;
    totalHT: number;
  }>;
  vatBreakdown: Array<{ rate: number; baseHT: number; vat: number }>;
  totals: {
    ht: number;
    vat: number;
    ttc: number;
    discountTotal: number;
    balanceDue?: number;
    paidTotal?: number;
  };
}

export interface InvoicePdfSourceCardex {
  identity: CardexIdentity;
  address?: Address | null;
  company?: CardexCompany | null;
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

export function buildInvoicePdfClientView(cardex: InvoicePdfSourceCardex): InvoicePdfClientView {
  const company = cardex.company;
  if (company?.legalName?.trim()) {
    const secondaryLines: string[] = [];
    if (company.siret?.trim()) secondaryLines.push(`SIRET ${company.siret.trim()}`);
    if (company.vatNumber?.trim()) secondaryLines.push(`TVA ${company.vatNumber.trim()}`);
    const personName = `${cardex.identity.firstName} ${cardex.identity.lastName}`.trim();
    if (personName) secondaryLines.push(`Contact : ${personName}`);
    return {
      displayName: company.legalName.trim(),
      secondaryLines,
      addressLines: formatAddressLines(company.billingAddress ?? cardex.address),
    };
  }

  return {
    displayName: `${cardex.identity.firstName} ${cardex.identity.lastName}`.trim(),
    secondaryLines: [],
    addressLines: formatAddressLines(cardex.address),
  };
}

export function resolveInvoicePdfPaymentMethod(input: {
  paymentMethod?: string | null;
  awaitingPaymentMethod?: string | null;
}): InvoicePdfPaymentMethod {
  const raw = (input.paymentMethod ?? input.awaitingPaymentMethod ?? "").trim();
  if (raw === "card" || raw === "bank_transfer") return raw;
  return "unknown";
}

export function resolveInvoicePdfPaymentStatus(
  invoice: InvoicePdfSourceInvoice,
): InvoicePdfPaymentStatus {
  const balanceDue = Math.max(0, Math.trunc(invoice.totals.balanceDue ?? invoice.totals.ttc));
  const paidTotal = Math.max(0, Math.trunc(invoice.totals.paidTotal ?? 0));
  if (invoice.status === "paid" || balanceDue <= 0) {
    return "paid";
  }
  if (invoice.status === "partially_paid" || (paidTotal > 0 && balanceDue > 0)) {
    return "partially_paid";
  }
  if (invoice.status === "proforma" || invoice.status === "issued") {
    return "awaiting";
  }
  return "other";
}

export function isInvoicePdfSpaceLine(kind: string | undefined): boolean {
  return (kind ?? "").trim() === "space";
}

export function buildInvoicePdfLineViews(
  lines: InvoicePdfSourceInvoice["lines"],
  reservation?: { startAt?: Date | string | null; endAt?: Date | string | null } | null,
): InvoicePdfLineView[] {
  const periodLabel =
    reservation?.startAt && reservation?.endAt
      ? formatAvailabilityWindow(reservation.startAt, reservation.endAt)
      : "";

  return lines.map((line) => {
    const kind = (line.kind ?? "other").trim() || "other";
    const isSpace = isInvoicePdfSpaceLine(kind);
    return {
      label: line.label,
      kind,
      qty: line.qty,
      qtyOrPeriodLabel: isSpace && periodLabel ? periodLabel : String(line.qty),
      unitPriceHT: line.unitPriceHT,
      vatRate: line.vatRate,
      discount: line.discount,
      totalHT: line.totalHT,
    };
  });
}

export function buildInvoicePdfViewModel(input: {
  invoice: InvoicePdfSourceInvoice;
  cardex: InvoicePdfSourceCardex;
  issuer: InvoiceIssuerConfig;
  logoDataUri: string;
  reservationReference?: string | null;
  reservationStartAt?: Date | string | null;
  reservationEndAt?: Date | string | null;
  paymentMethod?: string | null;
  awaitingPaymentMethod?: string | null;
  bankRib?: InvoicePdfBankRibView | null;
}): InvoicePdfViewModel {
  const issuedAt = asDate(input.invoice.issuedAt, new Date());
  const paymentMethod = resolveInvoicePdfPaymentMethod({
    paymentMethod: input.paymentMethod,
    awaitingPaymentMethod: input.awaitingPaymentMethod,
  });

  return {
    documentKindLabel: "PROFORMA",
    invoiceReference: input.invoice.reference,
    reservationReference: input.reservationReference?.trim() || undefined,
    issuedAt,
    dueDate: input.invoice.dueDate ? asDate(input.invoice.dueDate, issuedAt) : undefined,
    issuer: input.issuer,
    client: buildInvoicePdfClientView(input.cardex),
    lines: buildInvoicePdfLineViews(input.invoice.lines, {
      startAt: input.reservationStartAt,
      endAt: input.reservationEndAt,
    }),
    vatBreakdown: input.invoice.vatBreakdown.map((row) => ({
      rate: row.rate,
      baseHT: row.baseHT,
      vat: row.vat,
    })),
    totals: {
      ht: input.invoice.totals.ht,
      vat: input.invoice.totals.vat,
      ttc: input.invoice.totals.ttc,
      discountTotal: input.invoice.totals.discountTotal,
      paidTotal: Math.max(0, Math.trunc(input.invoice.totals.paidTotal ?? 0)),
      balanceDue: Math.max(
        0,
        Math.trunc(input.invoice.totals.balanceDue ?? input.invoice.totals.ttc),
      ),
    },
    paymentMethod,
    paymentStatus: resolveInvoicePdfPaymentStatus(input.invoice),
    bankRib: paymentMethod === "bank_transfer" ? (input.bankRib ?? null) : null,
    logoDataUri: input.logoDataUri,
  };
}
