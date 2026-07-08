import { describe, expect, it } from "vitest";

import { CreateSpaceRequestSchema, mapTariffInputsToDb, SpaceTariffInputSchema } from "./spaces.js";

const validPayload = {
  type: "meeting_room" as const,
  name: "Salon Part-Dieu",
  description: "Grande salle lumineuse.",
  floor: "RDC",
  capacity: 12,
  equipments: [{ key: "wifi", label: "Wifi" }],
  openingHours: [
    { day: "monday", is24h: false, openTime: "08:00", closeTime: "19:00" },
    { day: "tuesday", is24h: false, openTime: "08:00", closeTime: "19:00" },
    { day: "wednesday", is24h: false, openTime: "08:00", closeTime: "19:00" },
    { day: "thursday", is24h: false, openTime: "08:00", closeTime: "19:00" },
    { day: "friday", is24h: false, openTime: "08:00", closeTime: "19:00" },
    { day: "saturday", is24h: false, openTime: "08:00", closeTime: "13:00" },
    { day: "sunday", is24h: false, openTime: "00:00", closeTime: "00:00" },
  ],
  accessCode: "4821",
  status: "active" as const,
  tariffs: [
    { durationClass: "hourly" as const, priceEuros: 19.99, vatRate: 20, enabled: true },
    { durationClass: "daily" as const, priceEuros: 120, vatRate: 20, enabled: true },
    { durationClass: "monthly" as const, priceEuros: 450, vatRate: 20, enabled: false },
  ],
};

describe("CreateSpaceRequestSchema", () => {
  it("accepts a valid space payload with tariffs", () => {
    expect(CreateSpaceRequestSchema.safeParse(validPayload).success).toBe(true);
  });

  it("rejects invalid schedules", () => {
    const invalid = {
      ...validPayload,
      openingHours: validPayload.openingHours.map((entry, index) =>
        index === 0 ? { ...entry, openTime: "25:00" } : entry,
      ),
    };
    expect(CreateSpaceRequestSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects duplicate enabled durationClass", () => {
    const invalid = {
      ...validPayload,
      tariffs: [
        { durationClass: "hourly", priceEuros: 10, vatRate: 20, enabled: true },
        { durationClass: "hourly", priceEuros: 12, vatRate: 20, enabled: true },
      ],
    };
    expect(CreateSpaceRequestSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects more than five tariff lines", () => {
    const invalid = {
      ...validPayload,
      tariffs: [
        { durationClass: "hourly", priceEuros: 10, vatRate: 20, enabled: true },
        { durationClass: "halfday", priceEuros: 10, vatRate: 20, enabled: true },
        { durationClass: "daily", priceEuros: 10, vatRate: 20, enabled: true },
        { durationClass: "weekly", priceEuros: 10, vatRate: 20, enabled: true },
        { durationClass: "monthly", priceEuros: 10, vatRate: 20, enabled: true },
        { durationClass: "hourly", priceEuros: 11, vatRate: 20, enabled: false },
      ],
    };
    expect(CreateSpaceRequestSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects euro amounts with more than 2 decimals", () => {
    expect(
      SpaceTariffInputSchema.safeParse({
        durationClass: "hourly",
        priceEuros: 12.555,
        vatRate: 20,
        enabled: true,
      }).success,
    ).toBe(false);
  });

  it("rejects archived status on create/update payloads", () => {
    expect(
      CreateSpaceRequestSchema.safeParse({ ...validPayload, status: "archived" }).success,
    ).toBe(false);
  });
});

describe("mapTariffInputsToDb", () => {
  it("maps euros to centimes and drops disabled lines", () => {
    expect(mapTariffInputsToDb(validPayload.tariffs)).toEqual([
      { durationClass: "hourly", priceHT: 1999, vatRate: 20, enabled: true },
      { durationClass: "daily", priceHT: 12000, vatRate: 20, enabled: true },
    ]);
  });

  it("round-trips tricky amounts without float drift", () => {
    const mapped = mapTariffInputsToDb([
      { durationClass: "hourly", priceEuros: 19.99, vatRate: 20, enabled: true },
      { durationClass: "daily", priceEuros: 20, vatRate: 20, enabled: true },
    ]);
    expect(mapped[0]?.priceHT).toBe(1999);
    expect(mapped[1]?.priceHT).toBe(2000);
  });
});
