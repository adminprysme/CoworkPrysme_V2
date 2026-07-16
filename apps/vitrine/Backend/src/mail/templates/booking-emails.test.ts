import { describe, expect, it } from "vitest";

import {
  buildingToEmailAccess,
  renderAccountCreatedEmail,
  renderBookingConfirmationEmail,
  resolvePublicSiteUrl,
} from "./booking-emails.js";

const basePricing = {
  reservationReference: "RES-2026-00099",
  invoiceReference: "PF-2026-00099",
  spaceName: "Salle FOCUS",
  startAt: "21/07/2026 10:00:00",
  endAt: "21/07/2026 12:00:00",
  totalTTC: 4800,
  lines: [{ label: "Salle FOCUS", qty: 1, totalTTC: 4800 }],
  vatBreakdown: [{ rate: 20, baseHT: 4000, vat: 800 }],
};

describe("booking email templates", () => {
  it("renders access plan from the reserved building, not a hardcoded site", () => {
    const gerland = renderBookingConfirmationEmail({
      ...basePricing,
      building: buildingToEmailAccess({
        name: "Cowork GERLAND",
        email: "accueil-technopark-a1@coworkprysme.eu",
        phone: "07 83 82 35 29",
        address: {
          street: "39 Rue Saint-Jean de Dieu",
          zip: "69007",
          city: "Lyon",
          accessInfo:
            "Entrée principale le long de la grille — suivre l'allée. Sonner à CoworkPrysme.",
        },
        concierge: {
          url: "https://espaceclient.maconciergerie.eu/login?c=229&e=COR001",
          accessCode: "229",
        },
      }),
      siteUrl: "https://coworkprysme.eu",
    });

    const partDieu = renderBookingConfirmationEmail({
      ...basePricing,
      spaceName: "Bureau Horizon",
      building: buildingToEmailAccess({
        name: "Cowork PART-DIEU",
        email: "accueil-partdieu@coworkprysme.eu",
        phone: "04 00 00 00 00",
        accessCode: "PD-7788",
        address: {
          street: "12 rue fictive Part-Dieu",
          zip: "69003",
          city: "Lyon",
          accessInfo: "Hall B, 3e étage — badge visiteur à la réception.",
        },
        concierge: {
          url: "https://concierge.example.com/partdieu",
          accessCode: "PDX-42",
        },
      }),
      siteUrl: "http://localhost:3001",
    });

    expect(gerland.html).toContain("Plan d'accès — Cowork GERLAND");
    expect(gerland.html).toContain("39 Rue Saint-Jean de Dieu, 69007 Lyon");
    expect(gerland.html).toContain("Sonner à CoworkPrysme");
    expect(gerland.html).toContain("accueil-technopark-a1@coworkprysme.eu");
    expect(gerland.html).not.toContain("Bâtiment A1");

    expect(partDieu.html).toContain("Plan d'accès — Cowork PART-DIEU");
    expect(partDieu.html).toContain("12 rue fictive Part-Dieu, 69003 Lyon");
    expect(partDieu.html).toContain("Hall B, 3e étage");
    expect(partDieu.html).toContain("PD-7788");
    expect(partDieu.html).toContain("PDX-42");
    expect(partDieu.html).toContain("accueil-partdieu@coworkprysme.eu");
    expect(partDieu.html).toContain("http://localhost:3001/contact");
    expect(partDieu.html).not.toContain("Saint-Jean de Dieu");
    expect(partDieu.html).not.toContain("Bâtiment A1");
  });

  it("uses PUBLIC_SITE_URL for account privacy and contact links", () => {
    const previous = process.env.PUBLIC_SITE_URL;
    process.env.PUBLIC_SITE_URL = "https://staging.example.com";
    try {
      expect(resolvePublicSiteUrl()).toBe("https://staging.example.com");
      const account = renderAccountCreatedEmail({ email: "client@example.com" });
      expect(account.html).toContain("https://staging.example.com/politique-de-confidentialite");
      expect(account.html).toContain("staging.example.com");
    } finally {
      if (previous === undefined) {
        delete process.env.PUBLIC_SITE_URL;
      } else {
        process.env.PUBLIC_SITE_URL = previous;
      }
    }
  });
});
