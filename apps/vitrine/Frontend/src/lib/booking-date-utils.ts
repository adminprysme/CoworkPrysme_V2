import { formatAvailabilityWindow as formatAvailabilityWindowShared } from "@coworkprysme/shared";

const WEEKDAY_LABELS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."] as const;

export { WEEKDAY_LABELS };

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function isBeforeDay(left: Date, right: Date): boolean {
  return startOfDay(left).getTime() < startOfDay(right).getTime();
}

export function isAfterDay(left: Date, right: Date): boolean {
  return startOfDay(left).getTime() > startOfDay(right).getTime();
}

export function isPastDay(day: Date, today: Date = startOfDay(new Date())): boolean {
  return isBeforeDay(day, today);
}

export function isDayInRange(day: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) {
    return false;
  }
  const time = startOfDay(day).getTime();
  return time >= startOfDay(start).getTime() && time <= startOfDay(end).getTime();
}

export function buildMonthGrid(year: number, month: number): Array<Date | null> {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  while (cells.length < 42) {
    cells.push(null);
  }

  return cells;
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function formatDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function combineDateAndTime(date: Date, hhmm: string): Date {
  const [hourPart, minutePart] = hhmm.split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function defaultSearchStartTime(): string {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 2);
  return `${String(date.getHours()).padStart(2, "0")}:00`;
}

export function defaultSearchEndTime(startTime: string): string {
  const [hourPart] = startTime.split(":");
  const endHour = Math.min(Number(hourPart) + 1, 23);
  return `${String(endHour).padStart(2, "0")}:00`;
}

export function formatAvailabilityWindow(startAt: string, endAt: string): string {
  // Shared implementation (Europe/Paris) — keep calendar UI and PDF invoices aligned.
  return formatAvailabilityWindowShared(startAt, endAt);
}

export function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

export function addDays(date: Date, count: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}

export function monthRange(date: Date): { rangeStart: string; rangeEnd: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return {
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
  };
}

export function monthAnchor(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function isBeforeMonth(left: Date, right: Date): boolean {
  return monthAnchor(left).getTime() < monthAnchor(right).getTime();
}

export function isMonthInRange(month: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) {
    return false;
  }
  const time = monthAnchor(month).getTime();
  return time >= monthAnchor(start).getTime() && time <= monthAnchor(end).getTime();
}

export function multiMonthRange(
  startMonth: Date,
  endMonth: Date,
): { rangeStart: string; rangeEnd: string } {
  const start = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 0, 23, 59, 59, 999);
  return {
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
  };
}

export function formatFlexibleMonthSelection(
  startMonth: Date | null,
  endMonth: Date | null,
  allowRange: boolean,
): string {
  if (!startMonth) {
    return allowRange ? "Sélectionnez le premier mois." : "Sélectionnez un mois.";
  }

  if (!allowRange) {
    return `${formatMonthHeading(startMonth)} sélectionné.`;
  }

  if (!endMonth) {
    return `Début : ${formatMonthHeading(startMonth)} — choisissez le mois de fin.`;
  }

  if (isSameMonth(startMonth, endMonth)) {
    return `${formatMonthHeading(startMonth)} sélectionné.`;
  }

  return `Du ${formatMonthHeading(startMonth)} au ${formatMonthHeading(endMonth)}.`;
}

export type BookingFlexibleDuration = "day" | "week" | "month_plus";

export type BookingSearchMode = "dates" | "flexible";

export type CalendarDurationFilter = "all" | "hourly" | "daily";

export const FLEXIBLE_DURATION_OPTIONS: Array<{
  value: BookingFlexibleDuration;
  label: string;
}> = [
  { value: "day", label: "Un jour" },
  { value: "week", label: "Une semaine" },
  { value: "month_plus", label: "Un mois et plus" },
];

export function upcomingMonths(count: number, from: Date = new Date()): Date[] {
  const anchor = new Date(from.getFullYear(), from.getMonth(), 1);
  return Array.from(
    { length: count },
    (_, index) => new Date(anchor.getFullYear(), anchor.getMonth() + index, 1),
  );
}

export function formatMonthCardLabel(date: Date): { month: string; year: string } {
  const month = date.toLocaleDateString("fr-FR", { month: "long" });
  return {
    month: month.charAt(0).toUpperCase() + month.slice(1),
    year: String(date.getFullYear()),
  };
}

export function formatMonthHeading(date: Date): string {
  const label = date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function flexibleDurationClassHint(
  duration: BookingFlexibleDuration,
): CalendarDurationFilter {
  if (duration === "day") {
    return "daily";
  }
  return "all";
}

export function isSameMonth(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

/** Inclusive calendar days between start and end (same day = 1). */
export function countInclusiveDays(start: Date, end: Date): number {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / dayMs) + 1;
}

export const BOOKING_MONTHLY_MIN_DAYS = 28;

export type BookingDateRangeInputMode = "incomplete" | "same_day" | "short_stay" | "monthly";

export function resolveDateRangeInputMode(
  startDate: Date | null,
  endDate: Date | null,
): BookingDateRangeInputMode {
  if (!startDate || !endDate) {
    return "incomplete";
  }

  const days = countInclusiveDays(startDate, endDate);
  if (days <= 1) {
    return "same_day";
  }
  if (days >= BOOKING_MONTHLY_MIN_DAYS) {
    return "monthly";
  }
  return "short_stay";
}

export const DEFAULT_SHORT_STAY_ARRIVAL_TIME = "08:00";
export const DEFAULT_SHORT_STAY_DEPARTURE_TIME = "19:00";
export const DEFAULT_MONTHLY_ACCESS_START_TIME = "08:00";
export const DEFAULT_MONTHLY_ACCESS_END_TIME = "19:00";

export function defaultTimesForRangeMode(mode: BookingDateRangeInputMode): {
  startTime: string;
  endTime: string;
} {
  switch (mode) {
    case "same_day":
      return {
        startTime: defaultSearchStartTime(),
        endTime: defaultSearchEndTime(defaultSearchStartTime()),
      };
    case "short_stay":
    case "monthly":
      return {
        startTime: DEFAULT_SHORT_STAY_ARRIVAL_TIME,
        endTime: DEFAULT_SHORT_STAY_DEPARTURE_TIME,
      };
    case "incomplete":
      return {
        startTime: defaultSearchStartTime(),
        endTime: defaultSearchEndTime(defaultSearchStartTime()),
      };
  }
}

export function formatShortFrenchDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function buildSearchWindowForRangeMode(
  startDate: Date,
  endDate: Date,
  mode: BookingDateRangeInputMode,
  startTime: string,
  endTime: string,
): { startAt: string; endAt: string } {
  if (mode === "monthly") {
    return {
      startAt: combineDateAndTime(startDate, DEFAULT_MONTHLY_ACCESS_START_TIME).toISOString(),
      endAt: combineDateAndTime(endDate, DEFAULT_MONTHLY_ACCESS_END_TIME).toISOString(),
    };
  }

  return {
    startAt: combineDateAndTime(startDate, startTime).toISOString(),
    endAt: combineDateAndTime(endDate, endTime).toISOString(),
  };
}
