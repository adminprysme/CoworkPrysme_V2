import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { resolveVitrineBuildingFlags } from "./buildings-vitrine.js";

describe("resolveVitrineBuildingFlags", () => {
  it("auto-clears default when visible is turned off", () => {
    expect(
      resolveVitrineBuildingFlags({
        status: "active",
        visibleOnVitrine: false,
        isDefaultVitrineBuilding: true,
      }),
    ).toEqual({ visibleOnVitrine: false, isDefaultVitrineBuilding: false });
  });

  it("rejects inactive building marked visible on vitrine", () => {
    expect(() =>
      resolveVitrineBuildingFlags({
        status: "inactive",
        visibleOnVitrine: true,
        isDefaultVitrineBuilding: false,
      }),
    ).toThrow(BadRequestException);
  });

  it("rejects inactive building marked as default", () => {
    expect(() =>
      resolveVitrineBuildingFlags({
        status: "inactive",
        visibleOnVitrine: false,
        isDefaultVitrineBuilding: true,
      }),
    ).toThrow(BadRequestException);
  });

  it("allows active visible default building", () => {
    expect(
      resolveVitrineBuildingFlags({
        status: "active",
        visibleOnVitrine: true,
        isDefaultVitrineBuilding: true,
      }),
    ).toEqual({ visibleOnVitrine: true, isDefaultVitrineBuilding: true });
  });
});
