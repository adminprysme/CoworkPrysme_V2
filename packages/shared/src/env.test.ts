import { afterEach, describe, expect, it } from "vitest";

import {
  GENERIC_ENV_ERROR,
  parseGestionApiEnv,
  parseServerEnv,
  resetServerEnvCache,
} from "./env.js";

describe("parseServerEnv", () => {
  afterEach(() => {
    resetServerEnvCache();
  });

  it("accepts local mongodb URI in development", () => {
    const env = parseServerEnv({
      NODE_ENV: "development",
      MONGODB_URI: "mongodb://localhost:27017",
      MONGODB_DB_COWORK: "cowork_bdd",
      MONGODB_DB_PRYSMA: "prysma_bdd",
    });

    expect(env.MONGODB_URI).toBe("mongodb://localhost:27017");
  });

  it("rejects missing MONGODB_URI with a generic error", () => {
    expect(() =>
      parseServerEnv({
        NODE_ENV: "development",
        MONGODB_DB_COWORK: "cowork_bdd",
      }),
    ).toThrow(GENERIC_ENV_ERROR);
  });

  it("requires secure Mongo URI in production", () => {
    expect(() =>
      parseServerEnv({
        NODE_ENV: "production",
        MONGODB_URI: "mongodb://localhost:27017",
        MONGODB_DB_COWORK: "cowork_bdd",
        MONGODB_DB_PRYSMA: "prysma_bdd",
        NEXT_PUBLIC_SITE_URL: "https://example.com",
      }),
    ).toThrow(GENERIC_ENV_ERROR);
  });

  it("accepts mongodb+srv in production", () => {
    const env = parseServerEnv({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb+srv://cluster.example.com/db",
      MONGODB_DB_COWORK: "cowork_bdd",
      MONGODB_DB_PRYSMA: "prysma_bdd",
      NEXT_PUBLIC_SITE_URL: "https://example.com",
    });

    expect(env.MONGODB_URI).toContain("mongodb+srv://");
  });

  it("never includes secret values in error messages", () => {
    const secretUri = "mongodb://user:supersecret@localhost:27017";

    try {
      parseServerEnv({
        NODE_ENV: "production",
        MONGODB_URI: secretUri,
        NEXT_PUBLIC_SITE_URL: "https://example.com",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(GENERIC_ENV_ERROR);
      expect((error as Error).message).not.toContain("supersecret");
    }
  });

  it("parses comma-separated ALLOWED_ORIGIN for gestion-api", () => {
    const env = parseGestionApiEnv({
      NODE_ENV: "development",
      MONGODB_URI: "mongodb://localhost:27017",
      ALLOWED_ORIGIN: "http://localhost:3002,http://localhost:8002",
      SESSION_SECRET: "x".repeat(32),
    });

    expect(env.ALLOWED_ORIGIN).toEqual(["http://localhost:3002", "http://localhost:8002"]);
  });

  it("rejects wildcard ALLOWED_ORIGIN", () => {
    expect(() =>
      parseGestionApiEnv({
        NODE_ENV: "development",
        MONGODB_URI: "mongodb://localhost:27017",
        ALLOWED_ORIGIN: "*",
        SESSION_SECRET: "x".repeat(32),
      }),
    ).toThrow(GENERIC_ENV_ERROR);
  });

  it("accepts local auth configuration in development", () => {
    const env = parseGestionApiEnv({
      NODE_ENV: "development",
      MONGODB_URI: "mongodb://localhost:27017",
      ALLOWED_ORIGIN: "http://localhost:3002",
      AUTH_MODE: "local",
      SESSION_SECRET: "x".repeat(32),
    });

    expect(env.AUTH_MODE).toBe("local");
  });
});
