import { WEEK_DAYS, type WeekDay } from "../../lib/enums.js";
import type { BuildingDaySchedule } from "../../lib/subdocuments.js";

const BOOKING_TIMEZONE = "Europe/Paris";

const PARIS_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: BOOKING_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const parisLocalToUtcCache = new Map<string, Date>();

export interface OpeningHoursCheckable {
  openingHours: BuildingDaySchedule[];
}

export type OpeningHoursValidationResult = { valid: true } | { valid: false; closedDays: string[] };

export interface DateTimeRange {
  start: Date;
  end: Date;
}

export function parisDateParts(date: Date): { isoDate: string; day: WeekDay; minutes: number } {
  const parts = PARIS_DATE_PARTS_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const dayOfMonth = parts.find((part) => part.type === "day")?.value ?? "01";
  const weekday = parts.find((part) => part.type === "weekday")?.value?.toLowerCase() ?? "monday";
  const hourRaw = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const hour = hourRaw === 24 ? 0 : hourRaw;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const day = WEEK_DAYS.find((value) => value === weekday) ?? "monday";
  return {
    isoDate: `${year}-${month}-${dayOfMonth}`,
    day,
    minutes: hour * 60 + minute,
  };
}

export function parisLocalToUtc(isoDate: string, hhmm: string): Date {
  const cacheKey = `${isoDate}|${hhmm}`;
  const cached = parisLocalToUtcCache.get(cacheKey);
  if (cached) {
    return new Date(cached.getTime());
  }

  const targetMinutes = parseTimeToMinutes(hhmm);
  const [yearText, monthText, dayText] = isoDate.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const base = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

  const guessOffsets = [targetMinutes - 120, targetMinutes - 60];
  for (const guessOffset of guessOffsets) {
    for (let delta = -90; delta <= 90; delta += 1) {
      const candidate = new Date(base + (guessOffset + delta) * 60_000);
      const parts = parisDateParts(candidate);
      if (parts.isoDate === isoDate && parts.minutes === targetMinutes) {
        parisLocalToUtcCache.set(cacheKey, candidate);
        return candidate;
      }
    }
  }

  for (let offsetMinutes = -180; offsetMinutes <= 24 * 60; offsetMinutes += 1) {
    const candidate = new Date(base + offsetMinutes * 60_000);
    const parts = parisDateParts(candidate);
    if (parts.isoDate === isoDate && parts.minutes === targetMinutes) {
      parisLocalToUtcCache.set(cacheKey, candidate);
      return candidate;
    }
  }

  throw new Error(`Unable to resolve Paris local time ${isoDate} ${hhmm}`);
}

export function parseTimeToMinutes(value: string): number {
  const [hourPart, minutePart] = value.split(":");
  return Number(hourPart) * 60 + Number(minutePart);
}

export function rangesOverlap(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
): boolean {
  return leftStart < rightEnd && leftEnd > rightStart;
}

function addOneParisIsoDate(isoDate: string): string {
  const [yearText, monthText, dayText] = isoDate.split("-");
  const cursor = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  const year = cursor.getUTCFullYear();
  const month = String(cursor.getUTCMonth() + 1).padStart(2, "0");
  const day = String(cursor.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Inclusive Paris calendar days touched by [startAt, endAt). */
export function eachParisIsoDateBetween(startAt: Date, endAt: Date): string[] {
  const dates = new Set<string>();
  let cursor = new Date(startAt.getTime());
  const endMs = endAt.getTime();

  while (cursor.getTime() < endMs) {
    dates.add(parisDateParts(cursor).isoDate);
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  if (endMs > startAt.getTime()) {
    dates.add(parisDateParts(new Date(endMs - 1)).isoDate);
  }

  return [...dates].sort();
}

function scheduleForDay(
  openingHours: BuildingDaySchedule[],
  day: WeekDay,
): BuildingDaySchedule | undefined {
  return openingHours.find((entry) => entry.day === day);
}

function isInstantWithinDaySchedule(schedule: BuildingDaySchedule, instant: Date): boolean {
  if (schedule.is24h) {
    return true;
  }

  const openMinutes = parseTimeToMinutes(schedule.open);
  const closeMinutes = parseTimeToMinutes(schedule.close);
  const { minutes } = parisDateParts(instant);

  if (closeMinutes <= openMinutes) {
    return minutes >= openMinutes || minutes < closeMinutes;
  }

  return minutes >= openMinutes && minutes < closeMinutes;
}

function intersectRanges(left: DateTimeRange, right: DateTimeRange): DateTimeRange | null {
  const start = left.start > right.start ? left.start : right.start;
  const end = left.end < right.end ? left.end : right.end;
  if (end <= start) {
    return null;
  }
  return { start, end };
}

export function getOpeningWindowForDay(
  schedule: BuildingDaySchedule,
  isoDate: string,
): DateTimeRange | null {
  if (schedule.is24h) {
    return {
      start: parisLocalToUtc(isoDate, "00:00"),
      end: parisLocalToUtc(addOneParisIsoDate(isoDate), "00:00"),
    };
  }

  const openMinutes = parseTimeToMinutes(schedule.open);
  const closeMinutes = parseTimeToMinutes(schedule.close);

  if (openMinutes === closeMinutes) {
    return null;
  }

  if (closeMinutes > openMinutes) {
    return {
      start: parisLocalToUtc(isoDate, schedule.open),
      end: parisLocalToUtc(isoDate, schedule.close),
    };
  }

  return {
    start: parisLocalToUtc(isoDate, schedule.open),
    end: parisLocalToUtc(addOneParisIsoDate(isoDate), schedule.close),
  };
}

export function getStaySegmentForDay(
  isoDate: string,
  isoDates: string[],
  startAt: Date,
  endAt: Date,
): DateTimeRange | null {
  const dayStart = parisLocalToUtc(isoDate, "00:00");
  const dayEnd = parisLocalToUtc(addOneParisIsoDate(isoDate), "00:00");
  let segmentStart = dayStart;
  let segmentEnd = dayEnd;

  if (isoDate === isoDates[0]) {
    segmentStart = startAt > segmentStart ? startAt : segmentStart;
  }
  if (isoDate === isoDates[isoDates.length - 1]) {
    segmentEnd = endAt < segmentEnd ? endAt : segmentEnd;
  }

  if (segmentEnd <= segmentStart) {
    return null;
  }

  return { start: segmentStart, end: segmentEnd };
}

function validateSameDayRange(
  subject: OpeningHoursCheckable,
  startAt: Date,
  endAt: Date,
): OpeningHoursValidationResult {
  const startDay = parisDateParts(startAt).day;
  const schedule = scheduleForDay(subject.openingHours, startDay);
  if (!schedule) {
    return { valid: false, closedDays: [parisDateParts(startAt).isoDate] };
  }

  const withinHours =
    isInstantWithinDaySchedule(schedule, startAt) && isInstantWithinDaySchedule(schedule, endAt);

  if (!withinHours) {
    return { valid: false, closedDays: [parisDateParts(startAt).isoDate] };
  }

  return { valid: true };
}

function validateMultiDayRange(
  subject: OpeningHoursCheckable,
  startAt: Date,
  endAt: Date,
): OpeningHoursValidationResult {
  const isoDates = eachParisIsoDateBetween(startAt, endAt);
  const closedDays: string[] = [];

  for (const isoDate of isoDates) {
    const staySegment = getStaySegmentForDay(isoDate, isoDates, startAt, endAt);
    if (!staySegment) {
      closedDays.push(isoDate);
      continue;
    }

    const weekday = parisDateParts(parisLocalToUtc(isoDate, "12:00")).day;
    const schedule = scheduleForDay(subject.openingHours, weekday);
    if (!schedule) {
      closedDays.push(isoDate);
      continue;
    }

    const openingWindow = getOpeningWindowForDay(schedule, isoDate);
    if (!openingWindow) {
      closedDays.push(isoDate);
      continue;
    }

    const accessible = intersectRanges(staySegment, openingWindow);
    if (!accessible) {
      closedDays.push(isoDate);
    }
  }

  if (closedDays.length > 0) {
    return { valid: false, closedDays };
  }

  return { valid: true };
}

export function validateRangeOpeningHours(
  subject: OpeningHoursCheckable,
  startAt: Date,
  endAt: Date,
): OpeningHoursValidationResult {
  if (endAt <= startAt) {
    return { valid: false, closedDays: [] };
  }

  if (subject.openingHours.length === 0) {
    return { valid: true };
  }

  const startIsoDate = parisDateParts(startAt).isoDate;
  const endIsoDate = parisDateParts(new Date(endAt.getTime() - 1)).isoDate;

  if (startIsoDate === endIsoDate) {
    return validateSameDayRange(subject, startAt, endAt);
  }

  return validateMultiDayRange(subject, startAt, endAt);
}

/** Returns true when the entire [startAt, endAt) range fits within configured opening hours. */
export function isRangeWithinOpeningHours(
  subject: OpeningHoursCheckable,
  startAt: Date,
  endAt: Date,
): boolean {
  return validateRangeOpeningHours(subject, startAt, endAt).valid;
}

export { BOOKING_TIMEZONE };
