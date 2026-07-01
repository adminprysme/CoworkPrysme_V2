import { describe, expect, it } from "vitest";

import {
  BUILDING_DESCRIPTION_MAX_LENGTH,
  CreateBuildingRequestSchema,
  normalizeCountryFromDb,
  normalizeCountryToDb,
} from "./buildings.js";

const validPayload = {
  name: "Cowork Test",
  address: {
    street: "47 avenue Leclerc",
    postalCode: "69003",
    city: "Lyon",
    country: "France",
  },
  floors: [{ name: "RDC" }],
  status: "active" as const,
  accessibilityHours: [
    { day: "monday", is24h: false, openTime: "08:00", closeTime: "19:00" },
    { day: "tuesday", is24h: false, openTime: "08:00", closeTime: "19:00" },
    { day: "wednesday", is24h: false, openTime: "08:00", closeTime: "19:00" },
    { day: "thursday", is24h: false, openTime: "08:00", closeTime: "19:00" },
    { day: "friday", is24h: false, openTime: "08:00", closeTime: "19:00" },
    { day: "saturday", is24h: false, openTime: "08:00", closeTime: "13:00" },
    { day: "sunday", is24h: false, openTime: "00:00", closeTime: "00:00" },
  ],
  receptionHours: [
    { day: "monday", is24h: false, openTime: "08:00", closeTime: "19:00" },
    { day: "tuesday", is24h: false, openTime: "08:00", closeTime: "19:00" },
    { day: "wednesday", is24h: false, openTime: "08:00", closeTime: "19:00" },
    { day: "thursday", is24h: false, openTime: "08:00", closeTime: "19:00" },
    { day: "friday", is24h: false, openTime: "08:00", closeTime: "19:00" },
    { day: "saturday", is24h: false, openTime: "08:00", closeTime: "13:00" },
    { day: "sunday", is24h: false, openTime: "00:00", closeTime: "00:00" },
  ],
  concierge: { link: "", accessCode: "" },
};

describe("CreateBuildingRequestSchema", () => {
  it("accepts a valid building payload with postalCode", () => {
    expect(CreateBuildingRequestSchema.safeParse(validPayload).success).toBe(true);
  });

  it("rejects payloads with client coordinates (not part of the contract)", () => {
    const withCoords = { ...validPayload, lat: 45.76, lng: 4.86 };
    const parsed = CreateBuildingRequestSchema.safeParse(withCoords);
    expect(parsed.success).toBe(true);
    expect("lat" in (parsed.success ? parsed.data : {})).toBe(false);
  });

  it("rejects invalid postal schedules", () => {
    const invalid = {
      ...validPayload,
      accessibilityHours: validPayload.accessibilityHours.map((entry, index) =>
        index === 0 ? { ...entry, openTime: "25:00" } : entry,
      ),
    };
    expect(CreateBuildingRequestSchema.safeParse(invalid).success).toBe(false);
  });

  it("accepts an optional description up to the max length", () => {
    const withDescription = {
      ...validPayload,
      description: "Espace lumineux au cœur de Lyon.",
    };
    expect(CreateBuildingRequestSchema.safeParse(withDescription).success).toBe(true);
  });

  it("rejects descriptions longer than the max length", () => {
    const tooLong = {
      ...validPayload,
      description: "x".repeat(BUILDING_DESCRIPTION_MAX_LENGTH + 1),
    };
    expect(CreateBuildingRequestSchema.safeParse(tooLong).success).toBe(false);
  });

  it("accepts an empty description string", () => {
    expect(
      CreateBuildingRequestSchema.safeParse({ ...validPayload, description: "" }).success,
    ).toBe(true);
  });
});

describe("country normalization", () => {
  it("maps France ↔ FR in both directions", () => {
    expect(normalizeCountryToDb("France")).toBe("FR");
    expect(normalizeCountryFromDb("FR")).toBe("France");
  });
});
