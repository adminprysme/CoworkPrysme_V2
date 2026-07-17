import type { SpaceType } from "@coworkprysme/shared";

import { formatDayKey, isBeforeDay, startOfDay } from "./booking-date-utils";

export const HOME_BOOKING_SEARCH_PARAMS = {
  spaceType: "spaceType",
  partySize: "partySize",
  startDate: "startDate",
  endDate: "endDate",
  autoSearch: "autoSearch",
} as const;

export interface HomeBookingSearchCriteria {
  spaceType: SpaceType;
  partySize: number;
  startDate: Date;
  endDate: Date;
  autoSearch: boolean;
}

const SPACE_TYPES = new Set<SpaceType>(["meeting_room", "private_office"]);

/** Parse a local calendar day `YYYY-MM-DD` (no UTC shift). */
export function parseLocalDayKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  const date = startOfDay(new Date(year, month - 1, day));
  if (formatDayKey(date) !== `${match[1]}-${match[2]}-${match[3]}`) {
    return null;
  }
  return date;
}

export function buildHomeBookingSearchHref(input: {
  spaceType: SpaceType;
  partySize: number;
  startDate: Date;
  endDate: Date;
  pathname?: string;
}): string {
  const params = new URLSearchParams({
    [HOME_BOOKING_SEARCH_PARAMS.spaceType]: input.spaceType,
    [HOME_BOOKING_SEARCH_PARAMS.partySize]: String(input.partySize),
    [HOME_BOOKING_SEARCH_PARAMS.startDate]: formatDayKey(input.startDate),
    [HOME_BOOKING_SEARCH_PARAMS.endDate]: formatDayKey(input.endDate),
    [HOME_BOOKING_SEARCH_PARAMS.autoSearch]: "1",
  });
  return `${input.pathname ?? "/reservation"}?${params.toString()}`;
}

export function parseHomeBookingSearchParams(
  search: string | URLSearchParams,
): HomeBookingSearchCriteria | null {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;

  const spaceTypeRaw = params.get(HOME_BOOKING_SEARCH_PARAMS.spaceType)?.trim() ?? "";
  if (!SPACE_TYPES.has(spaceTypeRaw as SpaceType)) {
    return null;
  }
  const spaceType = spaceTypeRaw as SpaceType;

  const partySizeRaw = params.get(HOME_BOOKING_SEARCH_PARAMS.partySize)?.trim() ?? "";
  const partySize = Number.parseInt(partySizeRaw, 10);
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > 50) {
    return null;
  }

  const startDate = parseLocalDayKey(params.get(HOME_BOOKING_SEARCH_PARAMS.startDate) ?? "");
  const endDate = parseLocalDayKey(params.get(HOME_BOOKING_SEARCH_PARAMS.endDate) ?? "");
  if (!startDate || !endDate) {
    return null;
  }
  if (isBeforeDay(endDate, startDate)) {
    return null;
  }

  const autoSearch = params.get(HOME_BOOKING_SEARCH_PARAMS.autoSearch) === "1";

  return { spaceType, partySize, startDate, endDate, autoSearch };
}

/** Remove home→reservation search params from the current URL (history.replaceState). */
export function stripHomeBookingSearchQuery(href: string = window.location.href): string {
  const url = new URL(href);
  for (const key of Object.values(HOME_BOOKING_SEARCH_PARAMS)) {
    url.searchParams.delete(key);
  }
  const cleaned = `${url.pathname}${url.search}${url.hash}`;
  if (typeof window !== "undefined") {
    window.history.replaceState({}, "", cleaned);
  }
  return cleaned;
}
