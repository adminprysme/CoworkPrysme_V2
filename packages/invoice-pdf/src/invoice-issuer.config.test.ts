import { describe, expect, it } from "vitest";

import { loadInvoiceIssuerConfig } from "./invoice-issuer.config.js";

describe("loadInvoiceIssuerConfig", () => {
  it("returns null when required fields are missing", () => {
    expect(loadInvoiceIssuerConfig({})).toBeNull();
    expect(
      loadInvoiceIssuerConfig({
        INVOICE_ISSUER_LEGAL_NAME: "CG Développement",
      }),
    ).toBeNull();
  });

  it("loads a complete issuer identity", () => {
    expect(
      loadInvoiceIssuerConfig({
        INVOICE_ISSUER_LEGAL_NAME: "CG Développement",
        INVOICE_ISSUER_LEGAL_FORM: "SAS",
        INVOICE_ISSUER_SHARE_CAPITAL: "Variable",
        INVOICE_ISSUER_ADDRESS_LINE1: "36 Allée des Prés Rouets, 69510 Messimy",
        INVOICE_ISSUER_ADDRESS_LINE2: "France",
        INVOICE_ISSUER_SIRET: "882 095 839 00016",
        INVOICE_ISSUER_VAT_NUMBER: "FR50888833258",
        INVOICE_ISSUER_RCS: "RCS Lyon 882 095 839",
        INVOICE_ISSUER_EMAIL: "contact@prysme.eu",
        INVOICE_ISSUER_PHONE: "04 78 86 92 55",
      }),
    ).toEqual({
      legalName: "CG Développement",
      legalForm: "SAS",
      shareCapital: "Variable",
      addressLine1: "36 Allée des Prés Rouets, 69510 Messimy",
      addressLine2: "France",
      siret: "882 095 839 00016",
      vatNumber: "FR50888833258",
      rcs: "RCS Lyon 882 095 839",
      email: "contact@prysme.eu",
      phone: "04 78 86 92 55",
    });
  });
});
