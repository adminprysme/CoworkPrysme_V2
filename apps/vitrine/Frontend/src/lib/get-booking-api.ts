import {
  BookingAvailabilityResponseSchema,
  BookingLockResponseSchema,
  BookingSpaceAvailabilityResponseSchema,
  BookingSpacesResponseSchema,
  type BookingAvailabilityQuery,
  type BookingLockResponse,
  type BookingSpaceAvailabilityQuery,
  type BookingSpaceCard,
  type BookingSpacesQuery,
  type CreateBookingLockRequest,
} from "@coworkprysme/shared";

import { bookingFetch, buildQuery, getApiBaseUrl } from "./booking-api-client.js";

export async function fetchBookingAvailability(
  query: BookingAvailabilityQuery,
): Promise<BookingSpaceCard[]> {
  const qs = buildQuery({
    spaceType: query.spaceType,
    startAt: query.startAt,
    endAt: query.endAt,
    partySize: query.partySize,
    buildingId: query.buildingId,
    floor: query.floor,
  });
  const data = await bookingFetch(`/booking/availability?${qs}`, BookingAvailabilityResponseSchema);
  return data.spaces;
}

export async function fetchBookingSpaces(query: BookingSpacesQuery): Promise<BookingSpaceCard[]> {
  const qs = buildQuery({
    spaceType: query.spaceType,
    partySize: query.partySize,
    buildingId: query.buildingId,
    floor: query.floor,
  });
  const data = await bookingFetch(`/booking/spaces?${qs}`, BookingSpacesResponseSchema);
  return data.spaces;
}

export async function fetchSpaceAvailability(
  spaceId: string,
  query: BookingSpaceAvailabilityQuery,
) {
  const qs = buildQuery({
    rangeStart: query.rangeStart,
    rangeEnd: query.rangeEnd,
  });
  return bookingFetch(
    `/booking/spaces/${encodeURIComponent(spaceId)}/availability?${qs}`,
    BookingSpaceAvailabilityResponseSchema,
  );
}

export async function createBookingLock(
  input: CreateBookingLockRequest,
): Promise<BookingLockResponse> {
  return bookingFetch("/booking/lock", BookingLockResponseSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function releaseBookingLock(lockId: string, sessionId: string): Promise<void> {
  const qs = buildQuery({ sessionId });
  await fetch(`${getApiBaseUrl()}/booking/lock/${encodeURIComponent(lockId)}?${qs}`, {
    method: "DELETE",
    cache: "no-store",
  });
}

export function toDatetimeLocalValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}
