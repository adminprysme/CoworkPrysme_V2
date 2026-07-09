import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./catalog-content/catalog-content.service.js", () => ({
  CatalogContentService: class CatalogContentService {},
}));

import { CatalogContentController } from "./catalog-content/catalog-content.controller.js";
import { CatalogContentService } from "./catalog-content/catalog-content.service.js";

const SRC_DIR = fileURLToPath(new URL(".", import.meta.url));

function walkControllers(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = join(dir, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      files.push(...walkControllers(absolutePath));
      continue;
    }
    if (entry.endsWith(".controller.ts")) {
      files.push(absolutePath);
    }
  }

  return files;
}

describe("vitrine-api read-only controllers", () => {
  it("declares no write HTTP decorators in controller files", () => {
    const controllerFiles = walkControllers(SRC_DIR);
    expect(controllerFiles.length).toBeGreaterThan(0);

    const writeDecoratorPattern = /@(Post|Put|Patch|Delete)\(/;

    for (const filePath of controllerFiles) {
      const source = readFileSync(filePath, "utf8");
      expect(source, filePath).not.toMatch(writeDecoratorPattern);
    }
  });

  it("catalog controller exposes GET routes only", () => {
    const source = readFileSync(
      join(SRC_DIR, "catalog-content/catalog-content.controller.ts"),
      "utf8",
    );

    expect(source).toContain('@Get("buildings")');
    expect(source).toContain('@Get("buildings/:slug/private-offices")');
    expect(source).toContain('@Get("buildings/:slug/meeting-rooms")');
    expect(source).toContain('@Get("tariffs/:slug")');
    expect(source).not.toMatch(/@(Post|Put|Patch|Delete)\(/);
  });
});

describe("vitrine-api read-only HTTP", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CatalogContentController],
      providers: [
        {
          provide: CatalogContentService,
          useValue: {
            listBuildings: async () => ({ buildings: [], defaultBuildingSlug: null }),
            getBuildingSpacesPage: async () => ({
              building: {},
              spaces: [],
              visibleBuildings: [],
            }),
            getTariffsPage: async () => ({
              building: {},
              groups: [],
              visibleBuildings: [],
            }),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects POST /catalog/buildings with 404 or 405", async () => {
    const response = await fetch(`${baseUrl}/catalog/buildings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "should-not-write" }),
    });

    expect([404, 405]).toContain(response.status);
  });
});
