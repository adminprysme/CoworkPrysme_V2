import { describe, expect, it } from "vitest";

import type { InvoiceIssuerConfig } from "../invoice-issuer.config.js";
import { buildQuotePdfViewModel } from "../quote-pdf.mapper.js";
import { QUOTE_PDF_VALIDITY_NOTICE, renderQuotePdfHtml } from "./quote.html.js";

const issuer: InvoiceIssuerConfig = {
  legalName: "CG Développement",
  legalForm: "SAS",
  shareCapital: "Variable",
  addressLine1: "36 Allée des Prés Rouets, 69510 Messimy",
  siret: "882 095 839 00016",
  vatNumber: "FR50888833258",
  rcs: "RCS Lyon 882 095 839",
};

const STAFF_ONLY_NOTE = "SECRET_INTERNAL_NOTE_NEVER_ON_CLIENT_PDF_xyz789";

describe("quote PDF template", () => {
  it("renders a devis with lines, totals, conditions and accept link", () => {
    const model = buildQuotePdfViewModel({
      quote: {
        reference: "DEV-2026-00099",
        issuedAt: new Date("2026-07-23T12:00:00.000Z"),
        validUntil: new Date("2026-08-15T00:00:00.000Z"),
        lines: [
          {
            label: "FOCUS",
            kind: "space",
            qty: 1,
            unitPriceHT: 10000,
            vatRate: 20,
            discount: 0,
            totalHT: 10000,
            startAt: "2026-09-01T08:00:00.000Z",
            endAt: "2026-09-05T18:00:00.000Z",
          },
          {
            label: "Café",
            kind: "service",
            qty: 2,
            unitPriceHT: 500,
            vatRate: 20,
            discount: 0,
            totalHT: 1000,
          },
        ],
        vatBreakdown: [{ rate: 20, baseHT: 11000, vat: 2200 }],
        totals: { ht: 11000, vat: 2200, ttc: 13200, discountTotal: 0 },
        depositPercent: 30,
        depositAmountTTC: 3960,
        paymentMethodPreferred: "bank_transfer",
        publicConditions: "Conditions publiques de test",
        paymentTermsLabel: "Acompte 30 % à la commande",
        prospect: {
          email: "prospect@example.com",
          firstName: "Ada",
          lastName: "Lovelace",
        },
        internalNote: STAFF_ONLY_NOTE,
      },
      issuer,
      logoDataUri: "data:image/png;base64,aaa",
      acceptUrl: "http://localhost:3001/accepter-devis?token=abc123token",
      now: new Date("2026-07-23T12:00:00.000Z"),
    });

    const html = renderQuotePdfHtml(model);

    expect(html).toContain("DEV-2026-00099");
    expect(html).toContain("DEVIS");
    expect(html).not.toContain("PROFORMA");
    expect(html).toContain("FOCUS");
    expect(html).toContain("Café");
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Accepter le devis");
    expect(html).toContain("http://localhost:3001/accepter-devis?token=abc123token");
    expect(html).toContain("Virement bancaire");
    expect(html).toContain("Conditions publiques de test");
    expect(html).toContain("Acompte 30 % à la commande");
    expect(html).toContain(QUOTE_PDF_VALIDITY_NOTICE);
    expect(html).toContain("Acompte (30");
    expect(model.documentKindLabel).toBe("DEVIS");
    expect(model).not.toHaveProperty("internalNote");
  });

  it("never includes internalNote in HTML even when present on source quote", () => {
    const model = buildQuotePdfViewModel({
      quote: {
        reference: "DEV-2026-00100",
        validUntil: new Date("2026-08-15T00:00:00.000Z"),
        lines: [
          {
            label: "Bureau",
            kind: "space",
            qty: 1,
            unitPriceHT: 1000,
            vatRate: 20,
            totalHT: 1000,
          },
        ],
        vatBreakdown: [{ rate: 20, baseHT: 1000, vat: 200 }],
        totals: { ht: 1000, vat: 200, ttc: 1200 },
        prospect: { email: "a@b.c", displayName: "Client" },
        internalNote: STAFF_ONLY_NOTE,
      },
      issuer,
      logoDataUri: "",
      acceptUrl: "https://example.com/accepter-devis?token=tok",
    });

    const html = renderQuotePdfHtml(model);
    expect(html).not.toContain(STAFF_ONLY_NOTE);
    expect(html).not.toContain("internalNote");
    expect(JSON.stringify(model)).not.toContain(STAFF_ONLY_NOTE);
  });

  it("never embeds payment QR on devis PDF (point 6 — invoice only)", () => {
    const model = buildQuotePdfViewModel({
      quote: {
        reference: "DEV-2026-00101",
        validUntil: new Date("2026-08-15T00:00:00.000Z"),
        lines: [
          {
            label: "Bureau",
            kind: "space",
            qty: 1,
            unitPriceHT: 1000,
            vatRate: 20,
            totalHT: 1000,
          },
        ],
        vatBreakdown: [{ rate: 20, baseHT: 1000, vat: 200 }],
        totals: { ht: 1000, vat: 200, ttc: 1200 },
        prospect: { email: "a@b.c", displayName: "Client" },
      },
      issuer,
      logoDataUri: "",
      acceptUrl: "https://example.com/accepter-devis?token=tok",
    });

    const html = renderQuotePdfHtml(model);
    expect(html).not.toContain("data-payment-qr");
    expect(html).not.toContain("Payer en ligne");
    expect(html).not.toContain("/payer-devis");
    expect(html).toContain("/accepter-devis");
  });
});
