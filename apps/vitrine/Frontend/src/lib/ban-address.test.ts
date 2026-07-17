import { describe, expect, it } from "vitest";

import { mapBanFeatureToAddress, mapBanResponseToSuggestions } from "./ban-address";

describe("mapBanFeatureToAddress", () => {
  it("maps housenumber + street + postcode + city", () => {
    const mapped = mapBanFeatureToAddress({
      properties: {
        label: "8 Rue du 11 Novembre 69560 Sainte-Colombe",
        name: "8 Rue du 11 Novembre",
        housenumber: "8",
        street: "Rue du 11 Novembre",
        postcode: "69560",
        city: "Sainte-Colombe",
      },
    });

    expect(mapped).toEqual({
      label: "8 Rue du 11 Novembre 69560 Sainte-Colombe",
      street: "8 Rue du 11 Novembre",
      zip: "69560",
      city: "Sainte-Colombe",
    });
  });

  it("falls back to name when street parts are missing", () => {
    const mapped = mapBanFeatureToAddress({
      properties: {
        label: "Place Bellecour 69002 Lyon",
        name: "Place Bellecour",
        postcode: "69002",
        city: "Lyon",
      },
    });

    expect(mapped?.street).toBe("Place Bellecour");
    expect(mapped?.zip).toBe("69002");
    expect(mapped?.city).toBe("Lyon");
  });

  it("returns null when properties are empty", () => {
    expect(mapBanFeatureToAddress({})).toBeNull();
    expect(mapBanFeatureToAddress({ properties: {} })).toBeNull();
  });
});

describe("mapBanResponseToSuggestions", () => {
  it("skips invalid features and keeps valid ones", () => {
    const suggestions = mapBanResponseToSuggestions({
      features: [
        {},
        {
          properties: {
            label: "1 Rue de la République 69001 Lyon",
            housenumber: "1",
            street: "Rue de la République",
            postcode: "69001",
            city: "Lyon",
          },
        },
      ],
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.city).toBe("Lyon");
  });

  it("returns empty array for missing features", () => {
    expect(mapBanResponseToSuggestions({})).toEqual([]);
  });
});
