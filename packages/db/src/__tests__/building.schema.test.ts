import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { connectMongo, getCoworkDb, getPrysmaDb } from "../connection.js";
import { registerBuildingModel, type Building } from "../domains/structure/building.schema.js";
import { registerAllCoworkModels } from "../domains/register-cowork-models.js";
import { WEEK_DAYS } from "../lib/enums.js";
import {
  configureIntegrationEnv,
  clearCoworkCollections,
  startIntegrationMongo,
  stopIntegrationMongo,
} from "./integration/setup.js";

function defaultDaySchedules() {
  return WEEK_DAYS.map((day) => ({
    day,
    is24h: false,
    open: day === "sunday" ? "00:00" : "08:00",
    close: day === "sunday" ? "00:00" : day === "saturday" ? "13:00" : "19:00",
  }));
}

function minimalBuildingInput(): Omit<Building, "createdAt" | "updatedAt"> {
  return {
    name: "Cowork Part-Dieu",
    address: {
      street: "47 avenue Leclerc",
      zip: "69003",
      city: "Lyon",
      country: "FR",
    },
    coordinates: { lat: 45.7603, lng: 4.8606 },
    floors: [{ name: "RDC" }, { name: "1er" }],
    accessibilityHours: defaultDaySchedules(),
    receptionHours: defaultDaySchedules(),
    concierge: { url: "https://concierge.example.com", accessCode: "1234" },
    photos: [],
    status: "active" as const,
    visibleOnVitrine: false,
    isDefaultVitrineBuilding: false,
  };
}

describe("building schema", () => {
  it("declares geospatial and status indexes", () => {
    const connection = mongoose.createConnection();
    registerBuildingModel(connection);
    const schema = connection.models.Building!.schema;
    const indexes = schema.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ "coordinates.lat": 1, "coordinates.lng": 1 }, {}],
        [{ status: 1 }, {}],
        [
          { isDefaultVitrineBuilding: 1 },
          { unique: true, partialFilterExpression: { isDefaultVitrineBuilding: true } },
        ],
      ]),
    );
    void connection.close();
  });

  it("rejects invalid coordinates", () => {
    const connection = mongoose.createConnection();
    const Building = registerBuildingModel(connection);
    const doc = new Building({
      ...minimalBuildingInput(),
      coordinates: { lat: 95, lng: 4.86 },
    });

    const error = doc.validateSync();
    expect(error?.errors["coordinates.lat"]).toBeDefined();
    void connection.close();
  });

  it("rejects invalid day schedule times", () => {
    const connection = mongoose.createConnection();
    const Building = registerBuildingModel(connection);
    const input = minimalBuildingInput();
    input.accessibilityHours[0] = {
      day: "monday",
      is24h: false,
      open: "25:00",
      close: "19:00",
    };
    const doc = new Building(input);

    const error = doc.validateSync();
    expect(error?.errors["accessibilityHours.0.open"]).toBeDefined();
    void connection.close();
  });
});

describe("building persistence on cowork_bdd", () => {
  beforeAll(async () => {
    const uri = await startIntegrationMongo();
    await configureIntegrationEnv(uri);
    await connectMongo();
    registerAllCoworkModels(await getCoworkDb());
  }, 120_000);

  afterAll(async () => {
    await stopIntegrationMongo();
  });

  beforeEach(async () => {
    await clearCoworkCollections();
  });

  it("persists all form-aligned fields and preserves floor order", async () => {
    const Building = registerBuildingModel(await getCoworkDb());
    const input = minimalBuildingInput();
    input.photos = [
      { storageKey: "buildings/part-dieu/main.webp", order: 0, isPrimary: true },
      { storageKey: "buildings/part-dieu/lobby.webp", alt: "Hall", order: 1, isPrimary: false },
    ];

    const created = await Building.create(input);
    const found = await Building.findById(created._id).lean();

    expect(found).toMatchObject({
      name: input.name,
      address: input.address,
      coordinates: input.coordinates,
      floors: [{ name: "RDC" }, { name: "1er" }],
      concierge: input.concierge,
      status: "active",
    });
    expect(found?.accessCode).toBeUndefined();
    expect(found?.accessibilityHours).toHaveLength(7);
    expect(found?.receptionHours).toHaveLength(7);
    expect(found?.photos).toEqual(input.photos);
    expect(found?.floors.map((floor) => floor.name)).toEqual(["RDC", "1er"]);
    expect(found?.visibleOnVitrine).toBe(false);
    expect(found?.isDefaultVitrineBuilding).toBe(false);
  });

  it("stores buildings only on cowork_bdd, not on prysma_bdd", async () => {
    const cowork = await getCoworkDb();
    const prysma = await getPrysmaDb();
    const Building = registerBuildingModel(cowork);

    await Building.create(minimalBuildingInput());

    const coworkCollections = await cowork.db!.listCollections({ name: "buildings" }).toArray();
    expect(coworkCollections).toHaveLength(1);

    const prysmaCollections = await prysma.db!.listCollections({ name: "buildings" }).toArray();
    expect(prysmaCollections).toHaveLength(0);
    expect(Object.keys(prysma.models)).toEqual([]);
  });
});
