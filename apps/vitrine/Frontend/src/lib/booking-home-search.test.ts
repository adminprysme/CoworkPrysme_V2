import { describe, expect, it } from "vitest";

import {
  buildHomeBookingSearchHref,
  parseHomeBookingSearchParams,
  parseLocalDayKey,
  stripHomeBookingSearchQuery,
} from "./booking-home-search";

describe("booking-home-search", () => {
  it("parses local YYYY-MM-DD without UTC shift", () => {
    const day = parseLocalDayKey("2026-08-26");
    expect(day).not.toBeNull();
    expect(day!.getFullYear()).toBe(2026);
    expect(day!.getMonth()).toBe(7);
    expect(day!.getDate()).toBe(26);
  });

  it("rejects invalid calendar days", () => {
    expect(parseLocalDayKey("2026-02-31")).toBeNull();
    expect(parseLocalDayKey("26/08/2026")).toBeNull();
  });

  it("builds a reservation href with autoSearch=1", () => {
    const href = buildHomeBookingSearchHref({
      spaceType: "meeting_room",
      partySize: 4,
      startDate: new Date(2026, 7, 26),
      endDate: new Date(2026, 7, 28),
    });
    expect(href).toBe(
      "/reservation?spaceType=meeting_room&partySize=4&startDate=2026-08-26&endDate=2026-08-28&autoSearch=1",
    );
  });

  it("parses a full home search query including same-day range", () => {
    const parsed = parseHomeBookingSearchParams(
      "spaceType=private_office&partySize=2&startDate=2026-08-26&endDate=2026-08-26&autoSearch=1",
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.spaceType).toBe("private_office");
    expect(parsed!.partySize).toBe(2);
    expect(parsed!.autoSearch).toBe(true);
    expect(parsed!.startDate.getDate()).toBe(26);
    expect(parsed!.endDate.getDate()).toBe(26);
  });

  it("rejects inverted ranges and missing autoSearch still returns criteria with autoSearch false", () => {
    expect(
      parseHomeBookingSearchParams(
        "spaceType=meeting_room&partySize=4&startDate=2026-08-28&endDate=2026-08-26&autoSearch=1",
      ),
    ).toBeNull();

    const withoutFlag = parseHomeBookingSearchParams(
      "spaceType=meeting_room&partySize=4&startDate=2026-08-26&endDate=2026-08-28",
    );
    expect(withoutFlag?.autoSearch).toBe(false);
  });

  it("accepts partySize 80 and rejects 501", () => {
    expect(
      parseHomeBookingSearchParams(
        "spaceType=meeting_room&partySize=80&startDate=2026-08-26&endDate=2026-08-26&autoSearch=1",
      )?.partySize,
    ).toBe(80);
    expect(
      parseHomeBookingSearchParams(
        "spaceType=meeting_room&partySize=501&startDate=2026-08-26&endDate=2026-08-26&autoSearch=1",
      ),
    ).toBeNull();
  });

  it("strips home search params from an href", () => {
    const cleaned = stripHomeBookingSearchQuery(
      "http://localhost:3001/reservation?spaceType=meeting_room&partySize=4&startDate=2026-08-26&endDate=2026-08-28&autoSearch=1&keep=1",
    );
    expect(cleaned).toBe("/reservation?keep=1");
  });
});
