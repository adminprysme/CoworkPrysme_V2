import "reflect-metadata";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./catalog-content/catalog-content.service.js", () => ({
  CatalogContentService: class CatalogContentService {},
}));

vi.mock("./booking/booking.service.js", () => ({
  BookingService: class BookingService {},
}));

import { CatalogContentController } from "./catalog-content/catalog-content.controller.js";
import { CatalogContentService } from "./catalog-content/catalog-content.service.js";

const SRC_DIR = fileURLToPath(new URL(".", import.meta.url));
const BOOKING_CONTROLLER = "booking/booking.controller.ts";

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

function relativeControllerPath(filePath: string): string {
  return filePath.replace(`${SRC_DIR}/`, "");
}

describe("vitrine-api read-only controllers", () => {
  it("declares no write HTTP decorators except booking/slotLocks lock endpoints", () => {
    const controllerFiles = walkControllers(SRC_DIR);
    expect(controllerFiles.length).toBeGreaterThan(0);

    const writeDecoratorPattern = /@(Post|Put|Patch|Delete)\(/;

    for (const filePath of controllerFiles) {
      const relative = relativeControllerPath(filePath);
      const source = readFileSync(filePath, "utf8");

      if (relative.endsWith(BOOKING_CONTROLLER)) {
        expect(source).not.toMatch(/@(Put|Patch)\(/);
        expect(source).toMatch(/@Post\("lock"\)/);
        expect(source).toMatch(/@Post\("price"\)/);
        expect(source).toMatch(/@Post\("confirm"\)/);
        expect(source).toMatch(/@Delete\("lock\/:lockId"\)/);
        expect(source).not.toMatch(/createReservation|Reservation\.create/i);
        continue;
      }

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

  it("booking controller only exposes lock/unlock and stateless price writes", () => {
    const source = readFileSync(join(SRC_DIR, BOOKING_CONTROLLER), "utf8");
    const writeMatches = [...source.matchAll(/@(Post|Put|Patch|Delete)\(([^)]*)\)/g)];
    expect(writeMatches.map((match) => `${match[1]}(${match[2]})`)).toEqual([
      'Post("lock")',
      'Delete("lock/:lockId")',
      'Post("price")',
    ]);
  });
});

describe("vitrine-api read-only HTTP", () => {
  let catalogApp: INestApplication;
  let catalogBaseUrl: string;

  beforeAll(async () => {
    const catalogModuleRef = await Test.createTestingModule({
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

    catalogApp = catalogModuleRef.createNestApplication();
    await catalogApp.init();
    await catalogApp.listen(0);
    const catalogAddress = catalogApp.getHttpServer().address();
    const catalogPort =
      typeof catalogAddress === "object" && catalogAddress ? catalogAddress.port : 0;
    catalogBaseUrl = `http://127.0.0.1:${catalogPort}`;
  });

  afterAll(async () => {
    await catalogApp.close();
  });

  it("rejects POST /catalog/buildings with 404 or 405", async () => {
    const response = await fetch(`${catalogBaseUrl}/catalog/buildings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "should-not-write" }),
    });

    expect([404, 405]).toContain(response.status);
  });

  it("documents booking lock route in controller source", () => {
    const source = readFileSync(join(SRC_DIR, BOOKING_CONTROLLER), "utf8");
    expect(source).toMatch(/@Post\("lock"\)/);
    expect(source).toMatch(/@Delete\("lock\/:lockId"\)/);
  });
});
