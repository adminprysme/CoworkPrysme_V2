import { afterEach, describe, expect, it, vi } from "vitest";

const { modelSpy, pingSpy } = vi.hoisted(() => ({
  modelSpy: vi.fn(),
  pingSpy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("mongoose", () => {
  class Schema {
    constructor(_definition: unknown, _options?: unknown) {}
  }

  const connect = vi.fn().mockResolvedValue({
    connection: {
      useDb: vi.fn().mockReturnValue({
        db: {
          admin: () => ({ ping: pingSpy }),
        },
        models: {},
        model: modelSpy,
      }),
    },
  });

  return {
    default: { connect },
    Schema,
  };
});

vi.mock("./config.js", () => ({
  getMongoUri: () => "mongodb://localhost:27017",
  getCoworkDbName: () => "cowork_bdd",
  getPrysmaDbName: () => "prysma_bdd",
}));

import * as dbPackage from "./index.js";
import { connectMongo, resetMongoCache } from "./connection.js";
import { pingPrysmaDb } from "./health.js";
import { runCoworkReadinessCheck } from "./health.js";

describe("@coworkprysme/db public API", () => {
  it("does not export getPrysmaDb", () => {
    expect("getPrysmaDb" in dbPackage).toBe(false);
  });

  it("does not export getMongoUri", () => {
    expect("getMongoUri" in dbPackage).toBe(false);
  });

  it("does not export pingPrysmaDb", () => {
    expect("pingPrysmaDb" in dbPackage).toBe(false);
  });
});

describe("connectMongo singleton", () => {
  afterEach(() => {
    resetMongoCache();
    vi.clearAllMocks();
  });

  it("returns the same instance on consecutive calls", async () => {
    const first = await connectMongo();
    const second = await connectMongo();
    expect(first).toBe(second);
  });
});

describe("prysma read-only access", () => {
  afterEach(() => {
    resetMongoCache();
    vi.clearAllMocks();
  });

  it("pingPrysmaDb only performs a read-only admin ping", async () => {
    await pingPrysmaDb();

    expect(pingSpy).toHaveBeenCalledOnce();
    expect(modelSpy).not.toHaveBeenCalled();
  });

  it("runCoworkReadinessCheck only reports cowork status", async () => {
    const result = await runCoworkReadinessCheck();

    expect(result.checks).toHaveProperty("cowork");
    expect(typeof result.checks.cowork).toBe("boolean");
    expect("prysma" in result.checks).toBe(false);
  });
});
