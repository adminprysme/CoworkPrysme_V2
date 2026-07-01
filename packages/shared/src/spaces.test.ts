import { describe, expect, it } from "vitest";

import { CreateSpaceRequestSchema } from "./spaces.js";

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
};

describe("CreateSpaceRequestSchema", () => {
  it("accepts a valid space payload", () => {
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
});
