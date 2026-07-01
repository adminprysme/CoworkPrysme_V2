import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { connectMongo, getCoworkDb, getPrysmaDb } from "../connection.js";
import { registerAllCoworkModels } from "../domains/register-cowork-models.js";
import * as publicExports from "../index.js";
import {
  configureIntegrationEnv,
  startIntegrationMongo,
  stopIntegrationMongo,
} from "./integration/setup.js";

const DOMAINS_ROOT = fileURLToPath(new URL("../domains", import.meta.url));

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("prysma_bdd isolation", () => {
  it("does not expose getPrysmaDb via the public package API", () => {
    expect("getPrysmaDb" in publicExports).toBe(false);
  });

  it("domain source files never reference prysma write paths or getPrysmaDb", () => {
    const forbidden = [/getPrysmaDb/, /prysma_bdd/, /\.write\(/, /bulkWrite/];
    const domainFiles = collectSourceFiles(DOMAINS_ROOT);

    for (const file of domainFiles) {
      const content = readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        expect(content, `${file} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  describe("runtime model registration", () => {
    beforeAll(async () => {
      const uri = await startIntegrationMongo();
      await configureIntegrationEnv(uri);
      await connectMongo();
      const cowork = await getCoworkDb();
      registerAllCoworkModels(cowork);
    }, 120_000);

    afterAll(async () => {
      await stopIntegrationMongo();
    });

    it("registers all cowork models only on the cowork connection", async () => {
      const cowork = await getCoworkDb();
      expect(Object.keys(cowork.models).length).toBeGreaterThanOrEqual(22);
    });

    it("leaves the prysma connection with zero registered models", async () => {
      const prysma = await getPrysmaDb();
      expect(Object.keys(prysma.models)).toEqual([]);
    });
  });
});
