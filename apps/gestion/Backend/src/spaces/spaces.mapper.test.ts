import { describe, expect, it } from "vitest";

import type { CreateSpaceRequest } from "@coworkprysme/shared";

import {
  mapRequestToDbDocument,
  mapSpaceToResponse,
  resolveUniqueSlug,
  baseSlugForSpaceName,
} from "./spaces.mapper.js";

const sampleRequest: CreateSpaceRequest = {
  type: "meeting_room",
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
  status: "active",
  tariffs: [],
};

describe("spaces.mapper", () => {
  it("maps openTime/closeTime to open/close for MongoDB", () => {
    const buildingId = "507f1f77bcf86cd799439011" as never;
    const dbDoc = mapRequestToDbDocument(sampleRequest, buildingId, {
      slug: "salon-part-dieu",
      metaTitle: "Salon Part-Dieu | Cowork Prysme",
      metaDescription: "Grande salle lumineuse.",
    });

    expect(dbDoc.openingHours[0]?.open).toBe("08:00");
    expect(dbDoc.openingHours[0]?.close).toBe("19:00");
    expect(dbDoc.accessCode).toBe("4821");
    expect(dbDoc.floor).toBe("RDC");
  });

  it("maps open/close back to openTime/closeTime for API responses", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const response = mapSpaceToResponse({
      _id: "607f1f77bcf86cd799439022" as never,
      buildingId: "507f1f77bcf86cd799439011" as never,
      type: "meeting_room",
      name: "Salon Part-Dieu",
      description: "Grande salle lumineuse.",
      floor: "RDC",
      capacity: 12,
      equipments: [{ key: "wifi", label: "Wifi" }],
      openingHours: [
        { day: "monday", is24h: false, open: "08:00", close: "19:00" },
        { day: "tuesday", is24h: false, open: "08:00", close: "19:00" },
        { day: "wednesday", is24h: false, open: "08:00", close: "19:00" },
        { day: "thursday", is24h: false, open: "08:00", close: "19:00" },
        { day: "friday", is24h: false, open: "08:00", close: "19:00" },
        { day: "saturday", is24h: false, open: "08:00", close: "13:00" },
        { day: "sunday", is24h: false, open: "00:00", close: "00:00" },
      ],
      accessCode: "4821",
      photos: [
        {
          storageKey: "spaces/607f1f77bcf86cd799439022/a1b2c3d4-e5f6-7890-abcd-ef1234567890.webp",
          order: 0,
          isPrimary: true,
        },
      ],
      status: "active",
      seo: {
        slug: "salon-part-dieu",
        metaTitle: "Salon Part-Dieu | Cowork Prysme",
        metaDescription: "Grande salle lumineuse.",
      },
      tariffs: [{ durationClass: "hourly", priceHT: 1999, vatRate: 20, enabled: true }],
      createdAt: now,
      updatedAt: now,
    });

    expect(response.openingHours[0]?.openTime).toBe("08:00");
    expect(response.accessCode).toBe("4821");
    expect(response.seo.slug).toBe("salon-part-dieu");
    expect(response.photos[0]?.isPrimary).toBe(true);
    expect(response.tariffs[0]?.priceHT).toBe(1999);
  });

  it("maps tariff euros to centimes for MongoDB", () => {
    const buildingId = "507f1f77bcf86cd799439011" as never;
    const dbDoc = mapRequestToDbDocument(
      {
        ...sampleRequest,
        tariffs: [
          { durationClass: "hourly", priceEuros: 19.99, vatRate: 20, enabled: true },
          { durationClass: "daily", priceEuros: 20, vatRate: 20, enabled: true },
          { durationClass: "weekly", priceEuros: 100, vatRate: 20, enabled: false },
        ],
      },
      buildingId,
      {
        slug: "salon-part-dieu",
        metaTitle: "Salon Part-Dieu | Cowork Prysme",
        metaDescription: "Grande salle lumineuse.",
      },
    );

    expect(dbDoc.tariffs).toEqual([
      { durationClass: "hourly", priceHT: 1999, vatRate: 20, enabled: true },
      { durationClass: "daily", priceHT: 2000, vatRate: 20, enabled: true },
    ]);
  });

  it("deduplicates slug candidates for two spaces with the same name", () => {
    const baseSlug = baseSlugForSpaceName("Salon Identique");
    expect(baseSlug).toBe("salon-identique");

    const taken = new Set<string>(["salon-identique"]);
    expect(resolveUniqueSlug(baseSlug, taken)).toBe("salon-identique-2");

    taken.add("salon-identique-2");
    expect(resolveUniqueSlug(baseSlug, taken)).toBe("salon-identique-3");
  });

  it("clears optional accessCode and description when empty", () => {
    const buildingId = "507f1f77bcf86cd799439011" as never;
    const dbDoc = mapRequestToDbDocument(
      { ...sampleRequest, accessCode: "", description: "" },
      buildingId,
      {
        slug: "salon-part-dieu",
        metaTitle: "Salon Part-Dieu | Cowork Prysme",
        metaDescription: "Salon Part-Dieu — espace coworking Cowork Prysme.",
      },
    );

    expect(dbDoc.accessCode).toBeUndefined();
    expect(dbDoc.description).toBeUndefined();
  });
});
