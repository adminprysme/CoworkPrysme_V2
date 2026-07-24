import type { InvoiceIssuerConfig } from "./invoice-issuer.config.js";
import type { InvoicePdfBankRibView, InvoicePdfClientView } from "./invoice-pdf.types.js";

export type QuotePdfPaymentMethod = "card" | "bank_transfer" | "direct_debit" | "unknown";

export interface QuotePdfLineView {
  label: string;
  kind: string;
  qty: number;
  qtyOrPeriodLabel: string;
  unitPriceHT: number;
  vatRate: number;
  discount: number;
  totalHT: number;
}

export interface QuotePdfVatLineView {
  rate: number;
  baseHT: number;
  vat: number;
}

/**
 * View model for devis PDF / client email attachment.
 * Intentionally has NO `internalNote` — staff-only, never client-facing.
 */
export interface QuotePdfViewModel {
  documentKindLabel: "DEVIS";
  quoteReference: string;
  issuedAt: Date;
  validUntil: Date;
  issuer: InvoiceIssuerConfig;
  client: InvoicePdfClientView;
  lines: QuotePdfLineView[];
  vatBreakdown: QuotePdfVatLineView[];
  totals: {
    ht: number;
    vat: number;
    ttc: number;
    discountTotal: number;
  };
  depositPercent: number;
  depositAmountTTC?: number;
  paymentMethod: QuotePdfPaymentMethod;
  paymentTermsLabel?: string;
  publicConditions?: string;
  acceptUrl: string;
  bankRib?: InvoicePdfBankRibView | null;
  logoDataUri: string;
}
