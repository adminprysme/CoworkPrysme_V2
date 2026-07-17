import { describe, expect, it } from "vitest";

import { sortCatalogSpaces } from "./catalog-content.service.js";

describe("sortCatalogSpaces (vitrine catalogue — unchanged)", () => {
  it("still prefers featuredOnVitrine then vitrineOrder then name", () => {
    const sorted = sortCatalogSpaces([
      {
        name: "Near capacity but not featured",
        capacity: 2,
        featuredOnVitrine: false,
        vitrineOrder: 1,
      },
      {
        name: "Featured far capacity",
        capacity: 50,
        featuredOnVitrine: true,
        vitrineOrder: 2,
      },
      {
        name: "Featured first order",
        capacity: 40,
        featuredOnVitrine: true,
        vitrineOrder: 0,
      },
    ] as never);

    expect(sorted.map((s) => s.name)).toEqual([
      "Featured first order",
      "Featured far capacity",
      "Near capacity but not featured",
    ]);
  });
});
