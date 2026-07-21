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
  it("renders a minimal space-only proforma with reservation period instead of qty", () => {
    const model = buildInvoicePdfViewModel({
      invoice: {
        reference: "PF-2026-00022",
        type: "proforma",
        status: "paid",
        issuedAt: new Date("2026-07-17T14:43:30.522Z"),
        lines: [
          {
            label: "FOCUS",
            kind: "space",
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
      reservationStartAt: "2026-09-01T10:00:00.000Z",
      reservationEndAt: "2026-09-01T11:00:00.000Z",
      paymentMethod: "card",
    });

    const html = renderInvoiceProformaHtml(model);
    expect(html).toContain("PF-2026-00022");
    expect(html).toContain("PROFORMA");
    expect(html).not.toContain("FAC-");
    expect(html).toContain("FOCUS");
    expect(html).toContain("Qté / période");
    expect(html).toContain("→");
    expect(html).toContain("col-qty-period");
    expect(model.lines[0]?.qtyOrPeriodLabel).not.toBe("1");
    expect(model.lines[0]?.qtyOrPeriodLabel).toMatch(/→/);
    expect(html).toContain("E2E Listen");
    expect(html).toContain("Payé");
    expect(html).toContain("Carte bancaire");
    expect(html).toContain(INVOICE_LATE_PAYMENT_LEGAL_NOTICE.replaceAll("'", "&#39;"));
    expect(html).toContain('class="logo"');
    expect(html).toContain("height: 48px");
    expect(html).toContain("width: auto");
    expect(html).toContain("Base HT");
    expect(html).toContain("Montant TVA");
    expect(html).toContain('class="totals"');
    expect(html).not.toContain("total-row");
    expect(html).toContain("Situation de paiement");
    expect(html).toContain("Déjà réglé");
    expect(html).toContain("Reste dû");
  });

  it("shows paid and balance due amounts on a partially paid invoice with complement", () => {
    const model = buildInvoicePdfViewModel({
      invoice: {
        reference: "PF-2026-PARTIAL",
        type: "proforma",
        status: "partially_paid",
        issuedAt: new Date("2026-07-21T08:00:00.000Z"),
        lines: [
          {
            label: "FOCUS",
            kind: "space",
            qty: 1,
            unitPriceHT: 18000,
            vatRate: 20,
            discount: 0,
            totalHT: 18000,
          },
          {
            label: "Complément — prolongation (daily → daily, 2 unité(s))",
            kind: "fee",
            qty: 1,
            unitPriceHT: 18000,
            vatRate: 20,
            discount: 0,
            totalHT: 18000,
          },
        ],
        vatBreakdown: [{ rate: 20, baseHT: 36000, vat: 7200 }],
        totals: {
          ht: 36000,
          vat: 7200,
          ttc: 43200,
          discountTotal: 0,
          paidTotal: 21600,
          balanceDue: 21600,
        },
      },
      cardex: {
        identity: { firstName: "Paul", lastName: "Thomas" },
        company: { legalName: "CG Développement" },
      },
      issuer,
      logoDataUri: "data:image/png;base64,aaa",
      reservationReference: "RES-2026-PARTIAL",
      reservationStartAt: "2026-11-02T07:00:00.000Z",
      reservationEndAt: "2026-11-03T17:00:00.000Z",
      paymentMethod: "bank_transfer",
    });

    expect(model.paymentStatus).toBe("partially_paid");
    expect(model.totals.ttc).toBe(43200);
    expect(model.totals.paidTotal).toBe(21600);
    expect(model.totals.balanceDue).toBe(21600);

    const html = renderInvoiceProformaHtml(model);
    expect(html).toContain("Total TTC");
    expect(html).toContain("Partiellement payé");
    expect(html).toContain("Situation de paiement");
    expect(html).toContain("Déjà réglé");
    expect(html).toContain("Reste dû");
    // Full contract total remains visible (not replaced by remaining due).
    expect(html).toMatch(/Total TTC[\s\S]*432/);
    expect(html).toMatch(/Déjà réglé[\s\S]*216/);
    expect(html).toMatch(/Reste dû[\s\S]*216/);
  });

  it("keeps numeric qty for services and period for space on rich invoices", () => {
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
            kind: "space",
            qty: 1,
            unitPriceHT: 18000,
            vatRate: 20,
            discount: 3600,
            totalHT: 14400,
          },
          {
            label: "Café premium",
            kind: "service",
            qty: 2,
            unitPriceHT: 1999,
            vatRate: 20,
            discount: 800,
            totalHT: 3198,
          },
          {
            label: "Plateau repas traiteur végétarien longue dénomination commerciale",
            kind: "service",
            qty: 4,
            unitPriceHT: 2500,
            vatRate: 10,
            discount: 0,
            totalHT: 10000,
          },
          {
            label: "Vidéoprojecteur 4K",
            kind: "service",
            qty: 1,
            unitPriceHT: 4500,
            vatRate: 20,
            discount: 0,
            totalHT: 4500,
          },
          {
            label: "Paperboard + fournitures",
            kind: "service",
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
      reservationStartAt: "2026-07-24T06:00:00.000Z",
      reservationEndAt: "2026-07-25T17:00:00.000Z",
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
    expect(model.lines[0]?.qtyOrPeriodLabel).toMatch(/→/);
    expect(model.lines[1]?.qtyOrPeriodLabel).toBe("2");
    expect(html).toContain(INVOICE_LATE_PAYMENT_LEGAL_NOTICE.replaceAll("'", "&#39;"));
  });
});
