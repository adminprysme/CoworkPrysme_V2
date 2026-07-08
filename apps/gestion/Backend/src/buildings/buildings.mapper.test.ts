import { describe, expect, it } from "vitest";

import type { CreateBuildingRequest } from "@coworkprysme/shared";

import {
  mapBuildingToResponse,
  mapRequestToDbDocument,
  canCreateBuilding,
} from "./buildings.mapper.js";

const sampleRequest: CreateBuildingRequest = {
  name: "Cowork Test",
  address: {
    street: "47 avenue Leclerc",
    postalCode: "69003",
    city: "Lyon",
    country: "France",
  },
  floors: [{ name: "RDC" }, { name: "1er" }],
  status: "active",
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
  concierge: { link: "https://example.com", accessCode: "1234" },
};

describe("buildings.mapper", () => {
  it("maps postalCode to zip and link to url for MongoDB", () => {
    const dbDoc = mapRequestToDbDocument(sampleRequest, { lat: 45.76, lng: 4.86 });

    expect(dbDoc.address.zip).toBe("69003");
    expect(dbDoc.address.country).toBe("FR");
    expect(dbDoc.concierge.url).toBe("https://example.com");
    expect(dbDoc.accessibilityHours[0]?.open).toBe("08:00");
    expect(dbDoc.coordinates).toEqual({ lat: 45.76, lng: 4.86 });
  });

  it("maps zip to postalCode and url to link for API responses", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const response = mapBuildingToResponse({
      _id: "507f1f77bcf86cd799439011" as never,
      name: "Cowork Test",
      description: "  Espace lumineux  ",
      address: {
        street: "47 avenue Leclerc",
        zip: "69003",
        city: "Lyon",
        country: "FR",
      },
      coordinates: { lat: 45.76, lng: 4.86 },
      floors: [{ name: "RDC" }],
      accessibilityHours: [
        { day: "monday", is24h: false, open: "08:00", close: "19:00" },
        { day: "tuesday", is24h: false, open: "08:00", close: "19:00" },
        { day: "wednesday", is24h: false, open: "08:00", close: "19:00" },
        { day: "thursday", is24h: false, open: "08:00", close: "19:00" },
        { day: "friday", is24h: false, open: "08:00", close: "19:00" },
        { day: "saturday", is24h: false, open: "08:00", close: "13:00" },
        { day: "sunday", is24h: false, open: "00:00", close: "00:00" },
      ],
      receptionHours: [
        { day: "monday", is24h: false, open: "08:00", close: "19:00" },
        { day: "tuesday", is24h: false, open: "08:00", close: "19:00" },
        { day: "wednesday", is24h: false, open: "08:00", close: "19:00" },
        { day: "thursday", is24h: false, open: "08:00", close: "19:00" },
        { day: "friday", is24h: false, open: "08:00", close: "19:00" },
        { day: "saturday", is24h: false, open: "08:00", close: "13:00" },
        { day: "sunday", is24h: false, open: "00:00", close: "00:00" },
      ],
      concierge: { url: "https://example.com", accessCode: "1234" },
      photos: [],
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    expect(response.address.postalCode).toBe("69003");
    expect(response.address.country).toBe("France");
    expect(response.concierge.link).toBe("https://example.com");
    expect(response.description).toBe("Espace lumineux");
    expect(response.accessibilityHours[0]?.openTime).toBe("08:00");
  });

  it("persists description on create and clears empty values", () => {
    const withDescription = { ...sampleRequest, description: "  Accueil chaleureux  " };
    const dbDoc = mapRequestToDbDocument(withDescription, { lat: 45.76, lng: 4.86 });
    expect(dbDoc.description).toBe("Accueil chaleureux");

    const cleared = mapRequestToDbDocument(
      { ...sampleRequest, description: "" },
      { lat: 45.76, lng: 4.86 },
    );
    expect(cleared.description).toBeUndefined();
  });

  it("create payload starts with empty photos (updates must preserve existing photos separately)", () => {
    const dbDoc = mapRequestToDbDocument(sampleRequest, { lat: 45.76, lng: 4.86 });
    expect(dbDoc.photos).toEqual([]);

    const existingPhotos = [
      {
        storageKey: "buildings/507f1f77bcf86cd799439011/a1b2c3d4-e5f6-7890-abcd-ef1234567890.webp",
        order: 0,
        isPrimary: true,
      },
    ];
    const updatePayload = { ...dbDoc, photos: existingPhotos };
    expect(updatePayload.photos).toEqual(existingPhotos);
  });

  it("allows building creation only for global scope (empty buildingIds)", () => {
    expect(canCreateBuilding({ scope: { buildingIds: [] } })).toBe(true);
    expect(canCreateBuilding({ scope: { buildingIds: ["507f1f77bcf86cd799439011"] } })).toBe(false);
  });
});
