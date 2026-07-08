import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { connectMongo, getCoworkDb, getPrysmaDb } from "../connection.js";
import { registerBuildingModel } from "../domains/structure/building.schema.js";
import { registerSpaceModel, type Space } from "../domains/structure/space.schema.js";
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

function minimalSpaceInput(
  buildingId: mongoose.Types.ObjectId,
): Omit<Space, "createdAt" | "updatedAt"> {
  return {
    buildingId,
    type: "meeting_room",
    name: "Salon Part-Dieu",
    description: "Grande salle lumineuse.",
    floor: "RDC",
    capacity: 12,
    equipments: [
      { key: "projector", label: "Vidéoprojecteur" },
      { key: "wifi", label: "Wifi" },
    ],
    photos: [
      {
        storageKey: "spaces/507f1f77bcf86cd799439011/a1b2c3d4-e5f6-7890-abcd-ef1234567890.webp",
        order: 0,
        isPrimary: true,
      },
    ],
    openingHours: defaultDaySchedules(),
    accessCode: "4821",
    status: "active",
    seo: {
      slug: "salon-part-dieu",
      metaTitle: "Salon Part-Dieu | Cowork Prysme",
      metaDescription: "Grande salle lumineuse.",
    },
    tariffs: [],
  };
}

describe("space schema", () => {
  it("declares building and seo indexes", () => {
    const connection = mongoose.createConnection();
    registerSpaceModel(connection);
    const schema = connection.models.Space!.schema;
    const indexes = schema.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ buildingId: 1, type: 1, status: 1 }, {}],
        [{ "seo.slug": 1 }, { unique: true }],
      ]),
    );
    void connection.close();
  });

  it("rejects invalid opening hour times", () => {
    const connection = mongoose.createConnection();
    const Space = registerSpaceModel(connection);
    const buildingId = new mongoose.Types.ObjectId();
    const input = minimalSpaceInput(buildingId);
    input.openingHours[0] = {
      day: "monday",
      is24h: false,
      open: "25:00",
      close: "19:00",
    };
    const doc = new Space(input);

    const error = doc.validateSync();
    expect(error?.errors["openingHours.0.open"]).toBeDefined();
    void connection.close();
  });

  it("requires photos with isPrimary", () => {
    const connection = mongoose.createConnection();
    const Space = registerSpaceModel(connection);
    const buildingId = new mongoose.Types.ObjectId();
    const input = minimalSpaceInput(buildingId);
    input.photos = [
      {
        storageKey: "spaces/507f1f77bcf86cd799439011/a1b2c3d4-e5f6-7890-abcd-ef1234567890.webp",
        order: 0,
        isPrimary: true,
      },
    ];
    const doc = new Space(input);

    expect(doc.validateSync()).toBeUndefined();
    expect(doc.photos[0]?.isPrimary).toBe(true);
    void connection.close();
  });

  it("accepts embedded tariffs with integer centimes and default vatRate", () => {
    const connection = mongoose.createConnection();
    const Space = registerSpaceModel(connection);
    const buildingId = new mongoose.Types.ObjectId();
    const input = minimalSpaceInput(buildingId);
    input.tariffs = [
      { durationClass: "hourly", priceHT: 2500, vatRate: 20, enabled: true },
      { durationClass: "daily", priceHT: 15000, vatRate: 20, enabled: true },
      { durationClass: "monthly", priceHT: 45000, vatRate: 10, enabled: false },
    ];
    const doc = new Space(input);

    expect(doc.validateSync()).toBeUndefined();
    expect(doc.tariffs).toHaveLength(3);
    expect(doc.tariffs[0]?.priceHT).toBe(2500);
    void connection.close();
  });

  it("rejects non-integer priceHT in tariffs", () => {
    const connection = mongoose.createConnection();
    const Space = registerSpaceModel(connection);
    const buildingId = new mongoose.Types.ObjectId();
    const input = minimalSpaceInput(buildingId);
    input.tariffs = [{ durationClass: "hourly", priceHT: 25.5, vatRate: 20, enabled: true }];
    const doc = new Space(input);

    const error = doc.validateSync();
    expect(error?.errors["tariffs.0.priceHT"]).toBeDefined();
    void connection.close();
  });

  it("rejects duplicate durationClass in tariffs", () => {
    const connection = mongoose.createConnection();
    const Space = registerSpaceModel(connection);
    const buildingId = new mongoose.Types.ObjectId();
    const input = minimalSpaceInput(buildingId);
    input.tariffs = [
      { durationClass: "hourly", priceHT: 2500, vatRate: 20, enabled: true },
      { durationClass: "hourly", priceHT: 3000, vatRate: 20, enabled: true },
    ];
    const doc = new Space(input);

    const error = doc.validateSync();
    expect(error?.errors.tariffs).toBeDefined();
    void connection.close();
  });

  it("rejects more than five tariffs", () => {
    const connection = mongoose.createConnection();
    const Space = registerSpaceModel(connection);
    const buildingId = new mongoose.Types.ObjectId();
    const input = minimalSpaceInput(buildingId);
    input.tariffs = [
      { durationClass: "hourly", priceHT: 1000, vatRate: 20, enabled: true },
      { durationClass: "halfday", priceHT: 2000, vatRate: 20, enabled: true },
      { durationClass: "daily", priceHT: 3000, vatRate: 20, enabled: true },
      { durationClass: "weekly", priceHT: 4000, vatRate: 20, enabled: true },
      { durationClass: "monthly", priceHT: 5000, vatRate: 20, enabled: true },
      { durationClass: "hourly", priceHT: 6000, vatRate: 20, enabled: false },
    ];
    const doc = new Space(input);

    const error = doc.validateSync();
    expect(error?.errors.tariffs).toBeDefined();
    void connection.close();
  });
});

describe("space persistence on cowork_bdd", () => {
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

  it("persists typed openingHours, photos with isPrimary, and seo", async () => {
    const cowork = await getCoworkDb();
    const Building = registerBuildingModel(cowork);
    const Space = registerSpaceModel(cowork);

    const building = await Building.create({
      name: "Cowork Test",
      address: { street: "1 rue Test", zip: "69003", city: "Lyon", country: "FR" },
      coordinates: { lat: 45.76, lng: 4.86 },
      floors: [{ name: "RDC" }],
      accessibilityHours: defaultDaySchedules(),
      receptionHours: defaultDaySchedules(),
      concierge: { url: "", accessCode: "" },
      photos: [],
      status: "active",
    });

    const input = minimalSpaceInput(building._id as mongoose.Types.ObjectId);
    const created = await Space.create(input);
    const found = await Space.findById(created._id).lean();

    expect(found).toMatchObject({
      name: input.name,
      description: input.description,
      floor: "RDC",
      capacity: 12,
      accessCode: "4821",
      status: "active",
      seo: input.seo,
    });
    expect(found?.openingHours).toHaveLength(7);
    expect(found?.openingHours[0]).toMatchObject({
      day: "monday",
      is24h: false,
      open: "08:00",
      close: "19:00",
    });
    expect(found?.photos[0]).toMatchObject({
      storageKey: input.photos[0]?.storageKey,
      order: 0,
      isPrimary: true,
    });
  });

  it("persists embedded tariffs with centimes and vatRate", async () => {
    const cowork = await getCoworkDb();
    const Building = registerBuildingModel(cowork);
    const Space = registerSpaceModel(cowork);

    const building = await Building.create({
      name: "Cowork Test",
      address: { street: "1 rue Test", zip: "69003", city: "Lyon", country: "FR" },
      coordinates: { lat: 45.76, lng: 4.86 },
      floors: [{ name: "RDC" }],
      accessibilityHours: defaultDaySchedules(),
      receptionHours: defaultDaySchedules(),
      concierge: { url: "", accessCode: "" },
      photos: [],
      status: "active",
    });

    const input = minimalSpaceInput(building._id as mongoose.Types.ObjectId);
    input.tariffs = [
      { durationClass: "hourly", priceHT: 3500, vatRate: 20, enabled: true },
      { durationClass: "halfday", priceHT: 12000, vatRate: 20, enabled: true },
      { durationClass: "daily", priceHT: 18000, vatRate: 20, enabled: false },
    ];
    const created = await Space.create(input);
    const found = await Space.findById(created._id).lean();

    expect(found?.tariffs).toEqual([
      { durationClass: "hourly", priceHT: 3500, vatRate: 20, enabled: true },
      { durationClass: "halfday", priceHT: 12000, vatRate: 20, enabled: true },
      { durationClass: "daily", priceHT: 18000, vatRate: 20, enabled: false },
    ]);
  });

  it("rejects duplicate seo.slug across spaces", async () => {
    const cowork = await getCoworkDb();
    const Building = registerBuildingModel(cowork);
    const Space = registerSpaceModel(cowork);

    const buildingA = await Building.create({
      name: "Site A",
      address: { street: "1 rue A", zip: "69001", city: "Lyon", country: "FR" },
      coordinates: { lat: 45.76, lng: 4.86 },
      floors: [{ name: "RDC" }],
      accessibilityHours: defaultDaySchedules(),
      receptionHours: defaultDaySchedules(),
      concierge: { url: "", accessCode: "" },
      photos: [],
      status: "active",
    });
    const buildingB = await Building.create({
      name: "Site B",
      address: { street: "2 rue B", zip: "69002", city: "Lyon", country: "FR" },
      coordinates: { lat: 45.77, lng: 4.87 },
      floors: [{ name: "RDC" }],
      accessibilityHours: defaultDaySchedules(),
      receptionHours: defaultDaySchedules(),
      concierge: { url: "", accessCode: "" },
      photos: [],
      status: "active",
    });

    const slug = "salon-identique";
    await Space.createIndexes();
    await Space.create({
      ...minimalSpaceInput(buildingA._id as mongoose.Types.ObjectId),
      name: "Salon Identique",
      seo: {
        slug,
        metaTitle: "Salon Identique",
        metaDescription: "Premier espace",
      },
    });

    await expect(
      Space.create({
        ...minimalSpaceInput(buildingB._id as mongoose.Types.ObjectId),
        name: "Salon Identique",
        seo: {
          slug,
          metaTitle: "Salon Identique",
          metaDescription: "Deuxième espace",
        },
      }),
    ).rejects.toThrow();
  });

  it("persists archived status with audit fields", async () => {
    const cowork = await getCoworkDb();
    const Building = registerBuildingModel(cowork);
    const Space = registerSpaceModel(cowork);

    const building = await Building.create({
      name: "Cowork Test",
      address: { street: "1 rue Test", zip: "69003", city: "Lyon", country: "FR" },
      coordinates: { lat: 45.76, lng: 4.86 },
      floors: [{ name: "RDC" }],
      accessibilityHours: defaultDaySchedules(),
      receptionHours: defaultDaySchedules(),
      concierge: { url: "", accessCode: "" },
      photos: [],
      status: "active",
    });

    const staffId = new mongoose.Types.ObjectId();
    const input = minimalSpaceInput(building._id as mongoose.Types.ObjectId);
    const created = await Space.create({
      ...input,
      status: "archived",
      archivedAt: new Date("2026-01-15T10:00:00.000Z"),
      archivedBy: staffId,
      seo: {
        ...input.seo,
        slug: "salon-part-dieu-archived-439011",
      },
    });
    const found = await Space.findById(created._id).lean();

    expect(found?.status).toBe("archived");
    expect(found?.archivedAt?.toISOString()).toBe("2026-01-15T10:00:00.000Z");
    expect(found?.archivedBy?.toString()).toBe(staffId.toString());
  });

  it("stores spaces only on cowork_bdd, not on prysma_bdd", async () => {
    const cowork = await getCoworkDb();
    const prysma = await getPrysmaDb();
    const Building = registerBuildingModel(cowork);
    const Space = registerSpaceModel(cowork);

    const building = await Building.create({
      name: "Cowork Test",
      address: { street: "1 rue Test", zip: "69003", city: "Lyon", country: "FR" },
      coordinates: { lat: 45.76, lng: 4.86 },
      floors: [{ name: "RDC" }],
      accessibilityHours: defaultDaySchedules(),
      receptionHours: defaultDaySchedules(),
      concierge: { url: "", accessCode: "" },
      photos: [],
      status: "active",
    });

    await Space.create(minimalSpaceInput(building._id as mongoose.Types.ObjectId));

    const coworkCollections = await cowork.db!.listCollections({ name: "spaces" }).toArray();
    expect(coworkCollections).toHaveLength(1);

    const prysmaCollections = await prysma.db!.listCollections({ name: "spaces" }).toArray();
    expect(prysmaCollections).toHaveLength(0);
    expect(Object.keys(prysma.models)).toEqual([]);
  });
});
