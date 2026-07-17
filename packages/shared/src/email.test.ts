import { describe, expect, it } from "vitest";

import {
  EMAIL_BRAND_COPPER,
  renderCoworkEmailLayout,
  renderPaymentConfirmedEmail,
} from "./email.js";

describe("renderCoworkEmailLayout", () => {
  it("renders copper brand header and footer", () => {
    const html = renderCoworkEmailLayout("Titre", "<p>Corps</p>", "https://coworkprysme.eu");
    expect(html).toContain(`background:${EMAIL_BRAND_COPPER}`);
    expect(html).toContain("Cowork Prysme</h1>");
    expect(html).toContain("Cowork Prysme — coworkprysme.eu");
    expect(html).toContain("<p>Corps</p>");
  });
});

describe("renderPaymentConfirmedEmail", () => {
  const building = {
    name: "Cowork GERLAND",
    addressFull: "39 Rue Saint-Jean de Dieu, 69007 Lyon",
    accessInfo: "Sonner à CoworkPrysme",
    buildingAccessCode: "BLDG-9911",
    conciergeAccessCode: "229",
    conciergeUrl: "https://espaceclient.maconciergerie.eu/login",
    contactEmail: "accueil@coworkprysme.eu",
    contactPhone: "07 00 00 00 00",
  };

  it("uses shared chrome and highlights confirmed status for bank transfer", () => {
    const email = renderPaymentConfirmedEmail({
      reservationReference: "RES-2026-00019",
      invoiceReference: "PF-2026-00019",
      spaceName: "FOCUS",
      startAt: "12/08/2026 08:00:00",
      endAt: "14/08/2026 19:00:00",
      totalTTC: 21600,
      paymentMethod: "bank_transfer",
      building,
      siteUrl: "https://coworkprysme.eu",
    });

    expect(email.subject).toContain("RES-2026-00019");
    expect(email.html).toContain(`background:${EMAIL_BRAND_COPPER}`);
    expect(email.html).toContain("Cowork Prysme</h1>");
    expect(email.html).toContain("Statut : confirmée");
    expect(email.html).toContain("virement");
    expect(email.html).toContain("RES-2026-00019");
    expect(email.html).toContain("216,00");
    expect(email.html).toContain("Plan d'accès");
    expect(email.html).toContain("Code conciergerie");
    expect(email.html).toContain("229");
    expect(email.html).not.toContain("coordonnées bancaires");
  });

  it("mentions card payment when method is card", () => {
    const email = renderPaymentConfirmedEmail({
      reservationReference: "RES-2026-00100",
      invoiceReference: "PF-2026-00100",
      spaceName: "FOCUS",
      startAt: "01/09/2026 10:00:00",
      endAt: "01/09/2026 12:00:00",
      totalTTC: 4800,
      paymentMethod: "card",
      building,
      lines: [{ label: "FOCUS", qty: 1, totalTTC: 4800 }],
      vatBreakdown: [{ rate: 20, baseHT: 4000, vat: 800 }],
    });

    expect(email.html).toContain("paiement par carte");
    expect(email.html).toContain("Total TTC");
    expect(email.html).toContain("Ventilation TVA");
  });
});
