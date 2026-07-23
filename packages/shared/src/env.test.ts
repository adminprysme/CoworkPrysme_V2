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

  it("accepts mongodb:// with tls=true in production", () => {
    const env = parseServerEnv({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb://mongo.example.com:27017/db?tls=true",
      MONGODB_DB_COWORK: "cowork_bdd",
      MONGODB_DB_PRYSMA: "prysma_bdd",
      NEXT_PUBLIC_SITE_URL: "https://example.com",
    });

    expect(env.MONGODB_URI).toContain("tls=true");
    expect(env.MONGODB_INTERNAL_NETWORK_TRUSTED).toBe(false);
  });

  it("accepts plaintext mongodb:// in production when internal network is trusted", () => {
    const uri =
      "mongodb://coworkprysme_v2_app:secret@a48ggo0osck4c4044gw4ogok:27017/?authSource=admin&replicaSet=rs0";
    const env = parseServerEnv({
      NODE_ENV: "production",
      MONGODB_URI: uri,
      MONGODB_INTERNAL_NETWORK_TRUSTED: "true",
      MONGODB_DB_COWORK: "cowork_bdd",
      MONGODB_DB_PRYSMA: "prysma_bdd",
      NEXT_PUBLIC_SITE_URL: "https://example.com",
    });

    expect(env.MONGODB_URI).toBe(uri);
    expect(env.MONGODB_INTERNAL_NETWORK_TRUSTED).toBe(true);
  });

  it("rejects plaintext mongodb:// to a public-style host without tls/srv or trust flag", () => {
    expect(() =>
      parseServerEnv({
        NODE_ENV: "production",
        MONGODB_URI: "mongodb://user:pass@db.example.com:27017/db",
        MONGODB_DB_COWORK: "cowork_bdd",
        MONGODB_DB_PRYSMA: "prysma_bdd",
        NEXT_PUBLIC_SITE_URL: "https://example.com",
      }),
    ).toThrow(GENERIC_ENV_ERROR);
  });

  it("rejects plaintext mongodb:// when trust flag is not exactly true", () => {
    expect(() =>
      parseServerEnv({
        NODE_ENV: "production",
        MONGODB_URI: "mongodb://a48ggo0osck4c4044gw4ogok:27017/",
        MONGODB_INTERNAL_NETWORK_TRUSTED: "false",
        MONGODB_DB_COWORK: "cowork_bdd",
        MONGODB_DB_PRYSMA: "prysma_bdd",
        NEXT_PUBLIC_SITE_URL: "https://example.com",
      }),
    ).toThrow(GENERIC_ENV_ERROR);
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

  it("accepts PUBLIC_SITE_URL alone in production", () => {
    const env = parseServerEnv({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb+srv://cluster.example.com/db",
      MONGODB_DB_COWORK: "cowork_bdd",
      MONGODB_DB_PRYSMA: "prysma_bdd",
      PUBLIC_SITE_URL: "https://gestion.example.com",
    });

    expect(env.PUBLIC_SITE_URL).toBe("https://gestion.example.com");
    expect(env.NEXT_PUBLIC_SITE_URL).toBeUndefined();
    expect(env.SITE_URL).toBe("https://gestion.example.com");
  });

  it("accepts NEXT_PUBLIC_SITE_URL alone in production", () => {
    const env = parseServerEnv({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb+srv://cluster.example.com/db",
      MONGODB_DB_COWORK: "cowork_bdd",
      MONGODB_DB_PRYSMA: "prysma_bdd",
      NEXT_PUBLIC_SITE_URL: "https://vitrine.example.com",
    });

    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://vitrine.example.com");
    expect(env.PUBLIC_SITE_URL).toBeUndefined();
    expect(env.SITE_URL).toBe("https://vitrine.example.com");
  });

  it("prefers PUBLIC_SITE_URL over NEXT_PUBLIC_SITE_URL when both are set", () => {
    const env = parseServerEnv({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb+srv://cluster.example.com/db",
      MONGODB_DB_COWORK: "cowork_bdd",
      MONGODB_DB_PRYSMA: "prysma_bdd",
      PUBLIC_SITE_URL: "https://public.example.com",
      NEXT_PUBLIC_SITE_URL: "https://next.example.com",
    });

    expect(env.SITE_URL).toBe("https://public.example.com");
    expect(env.PUBLIC_SITE_URL).toBe("https://public.example.com");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://next.example.com");
  });

  it("rejects production when neither PUBLIC_SITE_URL nor NEXT_PUBLIC_SITE_URL is set", () => {
    expect(() =>
      parseServerEnv({
        NODE_ENV: "production",
        MONGODB_URI: "mongodb+srv://cluster.example.com/db",
        MONGODB_DB_COWORK: "cowork_bdd",
        MONGODB_DB_PRYSMA: "prysma_bdd",
      }),
    ).toThrow(GENERIC_ENV_ERROR);
  });

  it("parses comma-separated ALLOWED_ORIGIN for gestion-api", () => {
    const env = parseGestionApiEnv({
      NODE_ENV: "development",
      MONGODB_URI: "mongodb://localhost:27017",
      ALLOWED_ORIGIN: "http://localhost:3002,http://localhost:8002",
      SESSION_SECRET: "x".repeat(32),
      CLIENT_INVITE_TOKEN_SECRET: "y".repeat(32),
      QUOTE_ACCEPT_TOKEN_SECRET: "q".repeat(32),
      CLIENT_ACCOUNT_ACTIVATION_TOKEN_SECRET: "a".repeat(32),
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
        CLIENT_INVITE_TOKEN_SECRET: "y".repeat(32),
        QUOTE_ACCEPT_TOKEN_SECRET: "q".repeat(32),
        CLIENT_ACCOUNT_ACTIVATION_TOKEN_SECRET: "a".repeat(32),
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
      CLIENT_INVITE_TOKEN_SECRET: "y".repeat(32),
      QUOTE_ACCEPT_TOKEN_SECRET: "q".repeat(32),
      CLIENT_ACCOUNT_ACTIVATION_TOKEN_SECRET: "a".repeat(32),
    });

    expect(env.AUTH_MODE).toBe("local");
  });

  it("rejects partial Qonto configuration", () => {
    expect(() =>
      parseGestionApiEnv({
        NODE_ENV: "development",
        MONGODB_URI: "mongodb://localhost:27017",
        ALLOWED_ORIGIN: "http://localhost:3002",
        SESSION_SECRET: "x".repeat(32),
        CLIENT_INVITE_TOKEN_SECRET: "y".repeat(32),
        QUOTE_ACCEPT_TOKEN_SECRET: "q".repeat(32),
        CLIENT_ACCOUNT_ACTIVATION_TOKEN_SECRET: "a".repeat(32),
        QONTO_CLIENT_ID: "client-id",
      }),
    ).toThrow(GENERIC_ENV_ERROR);
  });

  it("accepts complete Qonto sandbox configuration", () => {
    const env = parseGestionApiEnv({
      NODE_ENV: "development",
      MONGODB_URI: "mongodb://localhost:27017",
      ALLOWED_ORIGIN: "http://localhost:3002",
      SESSION_SECRET: "x".repeat(32),
      CLIENT_INVITE_TOKEN_SECRET: "y".repeat(32),
      QUOTE_ACCEPT_TOKEN_SECRET: "q".repeat(32),
      CLIENT_ACCOUNT_ACTIVATION_TOKEN_SECRET: "a".repeat(32),
      QONTO_CLIENT_ID: "client-id",
      QONTO_CLIENT_SECRET: "client-secret",
      QONTO_STAGING_TOKEN: "staging-token",
      QONTO_REDIRECT_URI: "http://localhost:8003/integrations/qonto/callback",
      QONTO_TOKEN_ENCRYPTION_KEY: "k".repeat(32),
      QONTO_ENV: "sandbox",
    });

    expect(env.QONTO_CLIENT_ID).toBe("client-id");
    expect(env.QONTO_POLL_INTERVAL_MS).toBe(600_000);
  });
});
