import { describe, expect, it } from "vitest";

import { formatPublicBuildingAddress, mapDbBuildingToPublicInfo } from "./public-building-info.js";

describe("public-building-info", () => {
  it("formats address with optional access info", () => {
    expect(
      formatPublicBuildingAddress({
        street: "47 avenue Leclerc",
        postalCode: "69007",
        city: "Lyon",
        accessInfo: "Entrée par la grille",
      }),
    ).toBe("47 avenue Leclerc, Entrée par la grille, 69007 Lyon");
  });

  it("maps a Mongo building document to public info", () => {
    const result = mapDbBuildingToPublicInfo({
      name: "Cowork Prysme A1",
      phone: "04 78 86 92 55",
      email: "accueil@coworkprysme.eu",
      address: {
        street: "Technopark Lyon",
        zip: "69007",
        city: "Lyon",
        country: "FR",
        accessInfo: "Rue Saint-Jean-de-Dieu",
      },
      coordinates: { lat: 45.7284, lng: 4.8378 },
    });

    expect(result.name).toBe("Cowork Prysme A1");
    expect(result.phone).toBe("04 78 86 92 55");
    expect(result.email).toBe("accueil@coworkprysme.eu");
    expect(result.address.street).toBe("Technopark Lyon");
    expect(result.address.postalCode).toBe("69007");
    expect(result.address.accessInfo).toBe("Rue Saint-Jean-de-Dieu");
    expect(result.address.full).toContain("69007 Lyon");
    expect(result.mapExternalUrl).toContain("google.com/maps");
  });
});
