import type { InvoiceIssuerConfig } from "./invoice-issuer.config.js";

export type InvoicePdfPaymentMethod = "card" | "bank_transfer" | "unknown";

export type InvoicePdfPaymentStatus = "paid" | "partially_paid" | "awaiting" | "other";

export interface InvoicePdfLineView {
  label: string;
  kind: string;
  qty: number;
  /** Quantity for services, or reservation period label for space lines. */
  qtyOrPeriodLabel: string;
  unitPriceHT: number;
  vatRate: number;
  discount: number;
  totalHT: number;
}

export interface InvoicePdfVatLineView {
  rate: number;
  baseHT: number;
  vat: number;
}

export interface InvoicePdfClientView {
  displayName: string;
  secondaryLines: string[];
  addressLines: string[];
}

export interface InvoicePdfBankRibView {
  iban: string;
  bic: string;
  accountHolder: string;
  bankName?: string;
}

export interface InvoicePdfViewModel {
  documentKindLabel: "PROFORMA";
  invoiceReference: string;
  reservationReference?: string;
  issuedAt: Date;
  dueDate?: Date;
  issuer: InvoiceIssuerConfig;
  client: InvoicePdfClientView;
  lines: InvoicePdfLineView[];
  vatBreakdown: InvoicePdfVatLineView[];
  totals: {
    ht: number;
    vat: number;
    ttc: number;
    discountTotal: number;
    /** Amount already settled (cents). Always present for settlement clarity. */
    paidTotal: number;
    /** Remaining amount due (cents). Always present for settlement clarity. */
    balanceDue: number;
  };
  paymentMethod: InvoicePdfPaymentMethod;
  paymentStatus: InvoicePdfPaymentStatus;
  bankRib?: InvoicePdfBankRibView | null;
  /**
   * Quote-derived invoice payment URL (/payer-devis). When set, PDF embeds QR.
   * Classic booking invoices omit this — never show QR.
   */
  paymentUrl?: string;
  /** PNG data-URL for paymentUrl QR (generated server-side via `qrcode`). */
  paymentQrDataUri?: string;
  logoDataUri: string;
}
