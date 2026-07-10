import {
  BookingAvailabilityResponseSchema,
  BookingLockResponseSchema,
  BookingSpaceAvailabilityResponseSchema,
  BookingSpacesResponseSchema,
  type BookingAvailabilityQuery,
  type BookingAvailabilityResultSpace,
  type BookingFlexibilityDays,
  type BookingLockResponse,
  type BookingSpaceAvailabilityQuery,
  type BookingSpaceCard,
  type BookingSpacesQuery,
  type CreateBookingLockRequest,
} from "@coworkprysme/shared";

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8002";
}

async function bookingFetch<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof json === "object" &&
      json !== null &&
      "message" in json &&
      typeof json.message === "string"
        ? json.message
        : "Booking request failed";
    throw new Error(message);
  }

  return schema.parse(json);
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  return search.toString();
}

export async function fetchBookingAvailability(
  query: BookingAvailabilityQuery,
): Promise<BookingAvailabilityResultSpace[]> {
  const qs = buildQuery({
    spaceType: query.spaceType,
    startAt: query.startAt,
    endAt: query.endAt,
    partySize: query.partySize,
    buildingId: query.buildingId,
    floor: query.floor,
    flexibilityDays: query.flexibilityDays,
  });
  const data = await bookingFetch(`/booking/availability?${qs}`, BookingAvailabilityResponseSchema);
  return data.spaces;
}

export type { BookingAvailabilityResultSpace, BookingFlexibilityDays };

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

export function monthRange(date: Date): { rangeStart: string; rangeEnd: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return {
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
  };
}
