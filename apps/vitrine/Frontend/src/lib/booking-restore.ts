import type { BookingPhase1DurationClass, SpaceType } from "@coworkprysme/shared";

import type { BookingCartItem } from "@/components/booking/BookingServicesStep";
import type { BookingFlexibleDuration, BookingSearchMode } from "@/lib/booking-date-utils";

const RESTORE_STORAGE_KEY = "vitrine-booking-restore-v1";
const RESTORE_COOKIE_KEY = "vitrine-booking-restore-v1";
const RESTORE_COOKIE_MAX_LENGTH = 3800;

export type BookingRestoreView = "search" | "results" | "calendar" | "services";

export type BookingRestoreSnapshot = {
  version: 1;
  lockId: string;
  view: BookingRestoreView;
  searchMode: BookingSearchMode;
  spaceType: SpaceType;
  partySize: number;
  durationClass: BookingPhase1DurationClass;
  flexDuration: BookingFlexibleDuration | null;
  flexStartMonth: string | null;
  flexEndMonth: string | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string;
  endTime: string;
  cart: BookingCartItem[];
  discountCode: string;
};

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&")}=([^;]*)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function writeRestoreCookie(value: string): void {
  if (typeof document === "undefined" || value.length > RESTORE_COOKIE_MAX_LENGTH) {
    return;
  }

  document.cookie = `${RESTORE_COOKIE_KEY}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
}

function clearRestoreCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${RESTORE_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function parseSnapshot(raw: string | null): BookingRestoreSnapshot | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as BookingRestoreSnapshot;
    if (parsed.version !== 1 || typeof parsed.lockId !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveBookingRestoreSnapshot(snapshot: BookingRestoreSnapshot): void {
  if (typeof window === "undefined") {
    return;
  }

  const serialized = JSON.stringify(snapshot);
  window.sessionStorage.setItem(RESTORE_STORAGE_KEY, serialized);
  writeRestoreCookie(serialized);
}

export function loadBookingRestoreSnapshot(lockId: string): BookingRestoreSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  const fromStorage = parseSnapshot(window.sessionStorage.getItem(RESTORE_STORAGE_KEY));
  if (fromStorage?.lockId === lockId) {
    return fromStorage;
  }

  const fromCookie = parseSnapshot(readCookie(RESTORE_COOKIE_KEY));
  if (fromCookie?.lockId === lockId) {
    window.sessionStorage.setItem(RESTORE_STORAGE_KEY, JSON.stringify(fromCookie));
    return fromCookie;
  }

  return null;
}

export function clearBookingRestoreSnapshot(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(RESTORE_STORAGE_KEY);
  clearRestoreCookie();
}
