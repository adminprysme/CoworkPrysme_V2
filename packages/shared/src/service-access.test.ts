import { describe, expect, it } from "vitest";

import {
  ServiceAccessError,
  assertServiceContentUpdateAllowed,
  assertServiceCreateAllowed,
  assertServicePhotoMutationAllowed,
  getServiceEditMode,
  getServiceListFilter,
  mergeManagerBuildingIds,
  type ServiceAccessProfile,
  type ServiceRecordForAccess,
} from "./service-access.js";

const BUILDING_A = "507f1f77bcf86cd799439011";
const BUILDING_B = "507f1f77bcf86cd799439012";
const BUILDING_C = "507f1f77bcf86cd799439013";

const adminProfile: ServiceAccessProfile = { role: "admin", scopeBuildingIds: [] };
const managerProfile: ServiceAccessProfile = {
  role: "manager",
  scopeBuildingIds: [BUILDING_A],
};

const globalService: ServiceRecordForAccess = {
  id: "607f1f77bcf86cd799439021",
  isGlobal: true,
  buildingIds: [],
};

const scopedServiceAb: ServiceRecordForAccess = {
  id: "607f1f77bcf86cd799439022",
  isGlobal: false,
  buildingIds: [BUILDING_A, BUILDING_B],
};

describe("service access", () => {
  it("rejects manager creating a global service", () => {
    expect(() =>
      assertServiceCreateAllowed(managerProfile, { isGlobal: true, buildingIds: [] }),
    ).toThrow(ServiceAccessError);
    expect(() =>
      assertServiceCreateAllowed(managerProfile, { isGlobal: true, buildingIds: [] }),
    ).toThrow(/administrateur/);
  });

  it("rejects manager attaching a building outside scope", () => {
    expect(() =>
      assertServiceCreateAllowed(managerProfile, {
        isGlobal: false,
        buildingIds: [BUILDING_B],
      }),
    ).toThrow(ServiceAccessError);
    expect(() =>
      assertServiceCreateAllowed(managerProfile, {
        isGlobal: false,
        buildingIds: [BUILDING_B],
      }),
    ).toThrow(/périmètre/);
  });

  it("allows manager price-only update on global service and rejects label change", () => {
    expect(getServiceEditMode(managerProfile, globalService)).toBe("price_only");

    expect(() =>
      assertServiceContentUpdateAllowed(managerProfile, globalService, ["priceEurosHT"]),
    ).not.toThrow();

    expect(() =>
      assertServiceContentUpdateAllowed(managerProfile, globalService, ["label"]),
    ).toThrow(/seul le prix est modifiable/);

    expect(() => assertServicePhotoMutationAllowed(managerProfile, globalService)).toThrow(
      /seul le prix est modifiable/,
    );
  });

  it("allows admin unrestricted update on global service", () => {
    expect(getServiceEditMode(adminProfile, globalService)).toBe("all");
    expect(() =>
      assertServiceContentUpdateAllowed(adminProfile, globalService, [
        "label",
        "customQuestions",
        "isGlobal",
      ]),
    ).not.toThrow();
    expect(() => assertServicePhotoMutationAllowed(adminProfile, globalService)).not.toThrow();
  });

  it("merges frozen out-of-scope buildings for manager updates (T5)", () => {
    expect(getServiceEditMode(managerProfile, scopedServiceAb)).toBe("all");

    const merged = mergeManagerBuildingIds(
      [BUILDING_A, BUILDING_B],
      [BUILDING_A, BUILDING_B],
      managerProfile,
    );
    expect(merged).toHaveLength(2);
    expect(merged).toContain(BUILDING_A);
    expect(merged).toContain(BUILDING_B);

    expect(() =>
      mergeManagerBuildingIds([BUILDING_A, BUILDING_B], [BUILDING_A], managerProfile),
    ).toThrow(/retirer un bâtiment hors de votre périmètre/);

    expect(() =>
      mergeManagerBuildingIds(
        [BUILDING_A, BUILDING_B],
        [BUILDING_A, BUILDING_B, BUILDING_C],
        managerProfile,
      ),
    ).toThrow(/périmètre/);
  });

  it("builds manager list filter as isGlobal OR scope intersection", () => {
    expect(getServiceListFilter(adminProfile)).toEqual({});
    expect(getServiceListFilter(managerProfile)).toEqual({
      $or: [{ isGlobal: true }, { buildingIds: { $in: [BUILDING_A] } }],
    });
  });
});
