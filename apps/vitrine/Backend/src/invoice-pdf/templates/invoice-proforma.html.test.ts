import { describe, expect, it } from "vitest";

import type { InvoiceIssuerConfig } from "../invoice-issuer.config.js";
import { buildInvoicePdfViewModel } from "../invoice-pdf.mapper.js";
import {
  INVOICE_LATE_PAYMENT_LEGAL_NOTICE,
  renderInvoiceProformaHtml,
} from "./invoice-proforma.html.js";

const issuer: InvoiceIssuerConfig = {
  legalName: "CG Développement",
  legalForm: "SAS",
  shareCapital: "Variable",
  addressLine1: "36 Allée des Prés Rouets, 69510 Messimy",
  siret: "882 095 839 00016",
  vatNumber: "FR50888833258",
  rcs: "RCS Lyon 882 095 839",
};

describe("invoice PDF template", () => {
  it("renders a minimal space-only proforma with existing reference format", () => {
    const model = buildInvoicePdfViewModel({
      invoice: {
        reference: "PF-2026-00022",
        type: "proforma",
        status: "paid",
        issuedAt: new Date("2026-07-17T14:43:30.522Z"),
        lines: [
          {
            label: "FOCUS",
            qty: 1,
            unitPriceHT: 2000,
            vatRate: 20,
            discount: 0,
            totalHT: 2000,
          },
        ],
        vatBreakdown: [{ rate: 20, baseHT: 2000, vat: 400 }],
        totals: { ht: 2000, vat: 400, ttc: 2400, discountTotal: 0, balanceDue: 0 },
      },
      cardex: {
        identity: { firstName: "E2E", lastName: "Listen" },
        address: { street: "1 rue Test", zip: "69007", city: "Lyon", country: "FR" },
      },
      issuer,
      logoDataUri: "data:image/png;base64,aaa",
      reservationReference: "RES-2026-00022",
      paymentMethod: "card",
    });

    const html = renderInvoiceProformaHtml(model);
    expect(html).toContain("PF-2026-00022");
    expect(html).toContain("PROFORMA");
    expect(html).not.toContain("FAC-");
    expect(html).toContain("FOCUS");
    expect(html).toContain("E2E Listen");
    expect(html).toContain("Payé");
    expect(html).toContain("Carte bancaire");
    expect(html).toContain(INVOICE_LATE_PAYMENT_LEGAL_NOTICE.replaceAll("'", "&#39;"));
    expect(html).toContain('class="logo"');
    expect(html).toContain("height: 48px");
    expect(html).toContain("width: auto");
  });

  it("renders a rich invoice with company, discounts, many lines and bank transfer RIB", () => {
    const longName =
      "Société Européenne de Conseil Stratégique et d'Innovation Digitale Appliquée SASU";
    const model = buildInvoicePdfViewModel({
      invoice: {
        reference: "PF-2026-00020",
        type: "proforma",
        status: "proforma",
        issuedAt: new Date("2026-07-17T13:51:14.522Z"),
        dueDate: new Date("2026-07-25T00:00:00.000Z"),
        lines: [
          {
            label: "FOCUS — journée complète avec configuration salle modulable premium",
            qty: 1,
            unitPriceHT: 18000,
            vatRate: 20,
            discount: 3600,
            totalHT: 14400,
          },
          {
            label: "Café premium",
            qty: 2,
            unitPriceHT: 1999,
            vatRate: 20,
            discount: 800,
            totalHT: 3198,
          },
          {
            label: "Plateau repas traiteur végétarien longue dénomination commerciale",
            qty: 4,
            unitPriceHT: 2500,
            vatRate: 10,
            discount: 0,
            totalHT: 10000,
          },
          {
            label: "Vidéoprojecteur 4K",
            qty: 1,
            unitPriceHT: 4500,
            vatRate: 20,
            discount: 0,
            totalHT: 4500,
          },
          {
            label: "Paperboard + fournitures",
            qty: 2,
            unitPriceHT: 800,
            vatRate: 20,
            discount: 0,
            totalHT: 1600,
          },
        ],
        vatBreakdown: [
          { rate: 20, baseHT: 23698, vat: 4740 },
          { rate: 10, baseHT: 10000, vat: 1000 },
        ],
        totals: {
          ht: 33698,
          vat: 5740,
          ttc: 39438,
          discountTotal: 4400,
          balanceDue: 39438,
        },
      },
      cardex: {
        identity: { firstName: "Paul", lastName: "Thomas" },
        company: {
          legalName: longName,
          siret: "12345678901234",
          vatNumber: "FR12345678901",
          billingAddress: {
            street: "12 rue de la République, Bâtiment A, 3e étage, Bureau 312",
            zip: "69002",
            city: "Lyon",
            country: "FR",
          },
        },
      },
      issuer,
      logoDataUri: "data:image/png;base64,aaa",
      reservationReference: "RES-2026-00020",
      awaitingPaymentMethod: "bank_transfer",
      bankRib: {
        iban: "FR7612345678901234567890123",
        bic: "QNTOFRP1",
        accountHolder: "Cowork Prysme",
        bankName: "Qonto",
      },
    });

    const html = renderInvoiceProformaHtml(model);
    expect(html).toContain("Société Européenne de Conseil Stratégique");
    expect(html).toContain("SIRET 12345678901234");
    expect(html).toContain("Remise");
    expect(html).toContain("Virement bancaire");
    expect(html).toContain("En attente de paiement");
    expect(html).toContain("FR7612345678901234567890123");
    expect(html).toContain("RES-2026-00020");
    expect(html).toContain("Paperboard + fournitures");
    expect(html).toContain(INVOICE_LATE_PAYMENT_LEGAL_NOTICE.replaceAll("'", "&#39;"));
  });
});
