import type { DaySchedule, WeekDay } from "../types.js";
import { WEEK_DAYS } from "../types.js";

export function createDefaultDaySchedules(): DaySchedule[] {
  return WEEK_DAYS.map((day) => ({
    day,
    is24h: false,
    openTime: day === "sunday" ? "00:00" : "08:00",
    closeTime: day === "sunday" ? "00:00" : day === "saturday" ? "13:00" : "19:00",
  }));
}

export function copyDayScheduleToAll(source: DaySchedule, schedules: DaySchedule[]): DaySchedule[] {
  return schedules.map((entry) => ({
    ...entry,
    is24h: source.is24h,
    openTime: source.openTime,
    closeTime: source.closeTime,
  }));
}

export function updateDaySchedule(
  schedules: DaySchedule[],
  day: WeekDay,
  patch: Partial<DaySchedule>,
): DaySchedule[] {
  return schedules.map((entry) => (entry.day === day ? { ...entry, ...patch } : entry));
}

export function defaultFloorNames(count: number): string[] {
  if (count <= 0) {
    return [];
  }
  const names = ["RDC"];
  for (let index = 1; index < count; index += 1) {
    names.push(index === 1 ? "1er" : `${index}e`);
  }
  return names;
}

export function createFloors(count: number): { id: string; name: string }[] {
  return defaultFloorNames(count).map((name) => ({
    id: crypto.randomUUID(),
    name,
  }));
}

/** Mock geocoding for shell — Rhône department with slight jitter. */
export function mockGeocodeInRhone(seed: number): { lat: number; lng: number } {
  const baseLat = 45.75;
  const baseLng = 4.85;
  const angle = seed * 0.7;
  return {
    lat: baseLat + Math.sin(angle) * 0.08,
    lng: baseLng + Math.cos(angle) * 0.12,
  };
}

export function formatAddressSummary(address: {
  street: string;
  postalCode: string;
  city: string;
}): string {
  const parts = [address.street, `${address.postalCode} ${address.city}`.trim()].filter(Boolean);
  return parts.join(", ");
}
