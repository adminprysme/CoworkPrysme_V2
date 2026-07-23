import { describe, expect, it } from "vitest";

import {
  computeFrenchVatFromSiren,
  computeFrenchVatFromSiret,
  mapCompanyLookupHit,
  mapCompanyLookupResponse,
  mapEstablishmentAddress,
  normalizeSiretDigits,
} from "@coworkprysme/shared";

describe("company-lookup (vitrine re-export)", () => {
  it("still exposes VAT + SIRET helpers via shared", () => {
    expect(normalizeSiretDigits("882 095 839 00016")).toBe("88209583900016");
    expect(computeFrenchVatFromSiren("882095839")).toBe("FR71882095839");
    expect(computeFrenchVatFromSiret("88209583900016")).toBe("FR71882095839");
  });

  it("maps a gouv.fr hit", () => {
    const hit = {
      siren: "882095839",
      nom_raison_sociale: "CG DEVELOPPEMENT",
      siege: {
        siret: "88209583900016",
        numero_voie: "38",
        type_voie: "ROUTE",
        libelle_voie: "DE BRIGNAIS",
        code_postal: "69630",
        libelle_commune: "CHAPONOST",
      },
    };
    expect(mapCompanyLookupHit(hit, "88209583900016")?.legalName).toBe("CG DEVELOPPEMENT");
    expect(mapCompanyLookupResponse({ results: [hit] }, "88209583900016").status).toBe("ok");
    expect(mapEstablishmentAddress(hit.siege).city).toBe("Chaponost");
  });
});
