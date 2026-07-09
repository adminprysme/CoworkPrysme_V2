import { WEEK_DAYS, type WeekDay } from "../../lib/enums.js";
import type { BuildingDaySchedule } from "../../lib/subdocuments.js";

const BOOKING_TIMEZONE = "Europe/Paris";

export interface OpeningHoursCheckable {
  openingHours: BuildingDaySchedule[];
}

export function parisDateParts(date: Date): { isoDate: string; day: WeekDay; minutes: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOOKING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
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
  const targetMinutes = parseTimeToMinutes(hhmm);
  const [yearText, monthText, dayText] = isoDate.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const base = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

  // Paris local times for isoDate span roughly UTC-2h .. UTC+22h relative to UTC midnight.
  for (let offsetMinutes = -180; offsetMinutes <= 24 * 60; offsetMinutes += 1) {
    const candidate = new Date(base + offsetMinutes * 60_000);
    const parts = parisDateParts(candidate);
    if (parts.isoDate === isoDate && parts.minutes === targetMinutes) {
      return candidate;
    }
  }

  throw new Error(`Unable to resolve Paris local time ${isoDate} ${hhmm}`);
}

export function parseTimeToMinutes(value: string): number {
  const [hourPart, minutePart] = value.split(":");
  return Number(hourPart) * 60 + Number(minutePart);
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

/** Returns true when the entire [startAt, endAt) range fits within configured opening hours. */
export function isRangeWithinOpeningHours(
  subject: OpeningHoursCheckable,
  startAt: Date,
  endAt: Date,
): boolean {
  if (endAt <= startAt) {
    return false;
  }

  if (subject.openingHours.length === 0) {
    return true;
  }

  const startDay = parisDateParts(startAt).day;
  const endDay = parisDateParts(new Date(endAt.getTime() - 1)).day;
  if (startDay !== endDay) {
    // Phase 1: bookings must start and end on the same local calendar day.
    return false;
  }

  const schedule = scheduleForDay(subject.openingHours, startDay);
  if (!schedule) {
    return false;
  }

  return (
    isInstantWithinDaySchedule(schedule, startAt) && isInstantWithinDaySchedule(schedule, endAt)
  );
}

export { BOOKING_TIMEZONE };
