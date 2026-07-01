import { describe, expect, it } from "vitest";

import {
  buildSpaceSeoMeta,
  iterateSlugCandidates,
  resolveUniqueSlugFromSet,
  slugifySpaceName,
} from "./seo.js";

describe("slugifySpaceName", () => {
  it("converts names to kebab-case slugs", () => {
    expect(slugifySpaceName("Salon Part-Dieu")).toBe("salon-part-dieu");
    expect(slugifySpaceName("  Café & Réunion  ")).toBe("cafe-reunion");
  });

  it("falls back to espace for empty slugs", () => {
    expect(slugifySpaceName("---")).toBe("espace");
  });
});

describe("buildSpaceSeoMeta", () => {
  it("prefills meta fields from name and description", () => {
    expect(buildSpaceSeoMeta("Salon Part-Dieu", "Grande salle lumineuse.")).toEqual({
      slug: "salon-part-dieu",
      metaTitle: "Salon Part-Dieu | Cowork Prysme",
      metaDescription: "Grande salle lumineuse.",
    });
  });
});

describe("resolveUniqueSlugFromSet", () => {
  it("returns the base slug when available", () => {
    expect(resolveUniqueSlugFromSet("salon-part-dieu", new Set())).toBe("salon-part-dieu");
  });

  it("deduplicates two spaces with the same name via incremental suffixes", () => {
    const taken = new Set(["salon-part-dieu"]);
    expect(resolveUniqueSlugFromSet("salon-part-dieu", taken)).toBe("salon-part-dieu-2");

    taken.add("salon-part-dieu-2");
    expect(resolveUniqueSlugFromSet("salon-part-dieu", taken)).toBe("salon-part-dieu-3");
  });

  it("iterates slug candidates in order", () => {
    const candidates: string[] = [];
    for (const candidate of iterateSlugCandidates("salon")) {
      candidates.push(candidate);
      if (candidates.length >= 4) {
        break;
      }
    }
    expect(candidates).toEqual(["salon", "salon-2", "salon-3", "salon-4"]);
  });
});
