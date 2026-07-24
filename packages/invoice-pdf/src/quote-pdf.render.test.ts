import { afterAll, describe, expect, it } from "vitest";

import type { InvoiceIssuerConfig } from "./invoice-issuer.config.js";
import { InvoicePdfService } from "./invoice-pdf.service.js";
import { buildQuotePdfViewModel } from "./quote-pdf.mapper.js";

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

describe("quote PDF Playwright render", () => {
  const service = new InvoicePdfService();

  afterAll(async () => {
    await service.onModuleDestroy();
  });

  it("generates a real %PDF buffer that excludes internalNote", async () => {
    const model = buildQuotePdfViewModel({
      quote: {
        reference: "DEV-2026-PDF01",
        validUntil: new Date("2026-08-15T00:00:00.000Z"),
        lines: [
          {
            label: "FOCUS",
            kind: "space",
            qty: 1,
            unitPriceHT: 10000,
            vatRate: 20,
            totalHT: 10000,
            startAt: "2026-09-01T08:00:00.000Z",
            endAt: "2026-09-02T18:00:00.000Z",
          },
        ],
        vatBreakdown: [{ rate: 20, baseHT: 10000, vat: 2000 }],
        totals: { ht: 10000, vat: 2000, ttc: 12000 },
        prospect: { email: "a@b.c", firstName: "Ada", lastName: "Lovelace" },
        internalNote: STAFF_ONLY_NOTE,
      },
      issuer,
      logoDataUri: "",
      acceptUrl: "http://localhost:3001/accepter-devis?token=playwright-token",
    });

    const { pdf, html } = await service.generatePdfForQuoteViewModel(model);

    expect(html).not.toContain(STAFF_ONLY_NOTE);
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(800);
    expect(pdf.includes(Buffer.from(STAFF_ONLY_NOTE))).toBe(false);
  }, 60_000);
});
