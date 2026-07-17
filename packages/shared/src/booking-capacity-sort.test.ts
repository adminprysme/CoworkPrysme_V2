import { describe, expect, it } from "vitest";

import {
  BOOKING_PARTY_SIZE_MAX,
  BOOKING_PARTY_SIZE_MIN,
  BookingAvailabilityQuerySchema,
  BookingSpacesQuerySchema,
  sortSpacesByCapacityProximity,
} from "./booking.js";

describe("booking partySize bounds", () => {
  it("exposes technical ceiling of 500", () => {
    expect(BOOKING_PARTY_SIZE_MIN).toBe(1);
    expect(BOOKING_PARTY_SIZE_MAX).toBe(500);
  });

  it("accepts partySize 80 and 500 on spaces/availability queries", () => {
    expect(
      BookingSpacesQuerySchema.parse({ spaceType: "meeting_room", partySize: "80" }).partySize,
    ).toBe(80);
    expect(
      BookingAvailabilityQuerySchema.parse({
        spaceType: "private_office",
        startAt: "2026-08-20T08:00:00.000Z",
        endAt: "2026-08-20T10:00:00.000Z",
        partySize: 500,
      }).partySize,
    ).toBe(500);
  });

  it("rejects partySize above 500", () => {
    expect(() =>
      BookingSpacesQuerySchema.parse({ spaceType: "meeting_room", partySize: 501 }),
    ).toThrow();
  });

  it("accepts optional buildingId on spaces and availability queries", () => {
    expect(
      BookingSpacesQuerySchema.parse({
        spaceType: "meeting_room",
        partySize: 4,
        buildingId: "507f1f77bcf86cd799439012",
      }).buildingId,
    ).toBe("507f1f77bcf86cd799439012");
    expect(
      BookingSpacesQuerySchema.parse({ spaceType: "meeting_room", partySize: 4 }).buildingId,
    ).toBeUndefined();
  });
});

describe("sortSpacesByCapacityProximity", () => {
  it("orders private offices by closest capacity for 1 person", () => {
    const sorted = sortSpacesByCapacityProximity(
      [
        { name: "Bureau L", capacity: 10 },
        { name: "Bureau S", capacity: 2 },
        { name: "Bureau M", capacity: 4 },
      ],
      1,
    );
    expect(sorted.map((s) => s.capacity)).toEqual([2, 4, 10]);
  });

  it("orders meeting rooms by closest capacity for 3 people", () => {
    const sorted = sortSpacesByCapacityProximity(
      [
        { name: "Grande", capacity: 50 },
        { name: "Moyenne", capacity: 15 },
        { name: "Compacte", capacity: 6 },
      ],
      3,
    );
    expect(sorted.map((s) => s.name)).toEqual(["Compacte", "Moyenne", "Grande"]);
    expect(sorted.map((s) => s.capacity)).toEqual([6, 15, 50]);
  });

  it("breaks ties by name (fr)", () => {
    const sorted = sortSpacesByCapacityProximity(
      [
        { name: "Zulu", capacity: 4 },
        { name: "Alpha", capacity: 4 },
      ],
      3,
    );
    expect(sorted.map((s) => s.name)).toEqual(["Alpha", "Zulu"]);
  });

  it("does not use featured/vitrineOrder fields even if present", () => {
    const sorted = sortSpacesByCapacityProximity(
      [
        { name: "Featured Far", capacity: 20, featuredOnVitrine: true, vitrineOrder: 0 },
        { name: "Plain Near", capacity: 4, featuredOnVitrine: false, vitrineOrder: 99 },
      ],
      3,
    );
    expect(sorted.map((s) => s.name)).toEqual(["Plain Near", "Featured Far"]);
  });
});
