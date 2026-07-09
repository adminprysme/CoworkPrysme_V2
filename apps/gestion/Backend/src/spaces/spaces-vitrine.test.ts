import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { resolveSpaceVitrineFlags } from "./spaces-vitrine.js";

describe("resolveSpaceVitrineFlags", () => {
  it("rejects inactive space featured on vitrine", () => {
    expect(() =>
      resolveSpaceVitrineFlags({
        status: "inactive",
        featuredOnVitrine: true,
      }),
    ).toThrow(BadRequestException);
  });

  it("clears featured flag when status is inactive", () => {
    expect(
      resolveSpaceVitrineFlags({
        status: "inactive",
        featuredOnVitrine: false,
        vitrineOrder: 2,
      }),
    ).toEqual({ featuredOnVitrine: false, vitrineOrder: 2 });
  });

  it("allows active featured space with order", () => {
    expect(
      resolveSpaceVitrineFlags({
        status: "active",
        featuredOnVitrine: true,
        vitrineOrder: 1,
      }),
    ).toEqual({ featuredOnVitrine: true, vitrineOrder: 1 });
  });
});
