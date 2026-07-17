import { describe, expect, it } from "vitest";

import {
  computeFrenchVatFromSiren,
  computeFrenchVatFromSiret,
  mapCompanyLookupHit,
  mapCompanyLookupResponse,
  mapEstablishmentAddress,
  normalizeSiretDigits,
} from "./company-lookup";

describe("normalizeSiretDigits", () => {
  it("strips spaces and punctuation", () => {
    expect(normalizeSiretDigits("882 095 839 00016")).toBe("88209583900016");
  });
});

describe("computeFrenchVatFromSiren", () => {
  it("applies the official FR key formula", () => {
    // SIREN Cowork Prysme / CG DEVELOPPEMENT
    expect(computeFrenchVatFromSiren("882095839")).toBe("FR71882095839");
  });

  it("zero-pads single-digit keys", () => {
    // Crafted SIREN where (12 + 3*(n%97))%97 === 5 → FR05…
    // Find n such that key is 5: (12 + 3*r) % 97 = 5 → 3*r ≡ -7 ≡ 90 (mod 97) → r = 30
    // siren % 97 = 30 → e.g. 30
    expect(computeFrenchVatFromSiren("000000030")).toBe("FR05000000030");
  });

  it("rejects non-9-digit input", () => {
    expect(() => computeFrenchVatFromSiren("123")).toThrow(/9 digits/);
  });
});

describe("computeFrenchVatFromSiret", () => {
  it("uses the first 9 digits as SIREN", () => {
    expect(computeFrenchVatFromSiret("88209583900016")).toBe("FR71882095839");
  });
});

describe("mapEstablishmentAddress", () => {
  it("builds street from voie parts and title-cases city", () => {
    expect(
      mapEstablishmentAddress({
        numero_voie: "38",
        type_voie: "ROUTE",
        libelle_voie: "DE BRIGNAIS",
        code_postal: "69630",
        libelle_commune: "CHAPONOST",
      }),
    ).toEqual({
      street: "38 ROUTE DE BRIGNAIS",
      zip: "69630",
      city: "Chaponost",
    });
  });

  it("falls back to adresse string when parts are missing", () => {
    expect(
      mapEstablishmentAddress({
        adresse: "10 RUE DE LA PAIX 75002 PARIS",
        code_postal: "75002",
        libelle_commune: "PARIS",
      }),
    ).toEqual({
      street: "10 RUE DE LA PAIX",
      zip: "75002",
      city: "Paris",
    });
  });
});

describe("mapCompanyLookupHit / mapCompanyLookupResponse", () => {
  const hit = {
    siren: "882095839",
    nom_raison_sociale: "CG DEVELOPPEMENT",
    nom_complet: "CG DEVELOPPEMENT",
    siege: {
      siret: "88209583900016",
      numero_voie: "38",
      type_voie: "ROUTE",
      libelle_voie: "DE BRIGNAIS",
      code_postal: "69630",
      libelle_commune: "CHAPONOST",
      adresse: "38 ROUTE DE BRIGNAIS 69630 CHAPONOST",
    },
  };

  it("maps a matching siege to company fields + VAT", () => {
    const mapped = mapCompanyLookupHit(hit, "88209583900016");
    expect(mapped).toEqual({
      legalName: "CG DEVELOPPEMENT",
      siret: "88209583900016",
      vatNumber: "FR71882095839",
      address: {
        street: "38 ROUTE DE BRIGNAIS",
        zip: "69630",
        city: "Chaponost",
      },
    });
  });

  it("returns ok / not_found / invalid_siret outcomes", () => {
    expect(mapCompanyLookupResponse({ results: [hit] }, "88209583900016").status).toBe("ok");
    expect(mapCompanyLookupResponse({ results: [] }, "88209583900016").status).toBe("not_found");
    expect(mapCompanyLookupResponse({ results: [hit] }, "123").status).toBe("invalid_siret");
  });
});
