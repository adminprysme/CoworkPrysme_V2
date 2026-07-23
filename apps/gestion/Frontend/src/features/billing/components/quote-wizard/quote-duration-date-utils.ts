/** Date-range helpers mirrored from vitrine booking-date-utils (gestion-local copy). */

export const WEEKDAY_LABELS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."] as const;

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

export function isPastDay(day: Date, today: Date = startOfDay(new Date())): boolean {
  return isBeforeDay(day, today);
}

export function isDayInRange(day: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  const time = startOfDay(day).getTime();
  return time >= startOfDay(start).getTime() && time <= startOfDay(end).getTime();
}

export function buildMonthGrid(year: number, month: number): Array<Date | null> {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let index = 0; index < firstWeekday; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);
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

export function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

export function addDays(date: Date, count: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function combineDateAndTimeLocal(date: Date, hhmm: string): string {
  const [hourPart, minutePart] = hhmm.split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(hours)}:${pad2(minutes)}`;
}

export function parseLocalDatePart(local: string): Date | null {
  if (!local.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(local);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

export function parseLocalTimePart(local: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(local);
  return match ? `${match[1]}:${match[2]}` : "09:00";
}

export type QuoteDateRangeMode = "incomplete" | "same_day" | "short_stay" | "monthly";

export const QUOTE_MONTHLY_MIN_DAYS = 28;

export function countInclusiveDays(start: Date, end: Date): number {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / dayMs) + 1;
}

export function resolveQuoteDateRangeMode(
  startDate: Date | null,
  endDate: Date | null,
): QuoteDateRangeMode {
  if (!startDate || !endDate) return "incomplete";
  const days = countInclusiveDays(startDate, endDate);
  if (days <= 1) return "same_day";
  if (days >= QUOTE_MONTHLY_MIN_DAYS) return "monthly";
  return "short_stay";
}

function defaultSameDayStartTime(): string {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 2);
  return `${pad2(date.getHours())}:00`;
}

function defaultSameDayEndTime(startTime: string): string {
  const [hourPart] = startTime.split(":");
  const endHour = Math.min(Number(hourPart) + 1, 23);
  return `${pad2(endHour)}:00`;
}

export const DEFAULT_STAY_ARRIVAL = "08:00";
export const DEFAULT_STAY_DEPARTURE = "19:00";

export function defaultTimesForQuoteMode(mode: QuoteDateRangeMode): {
  startTime: string;
  endTime: string;
} {
  if (mode === "same_day" || mode === "incomplete") {
    const startTime = defaultSameDayStartTime();
    return { startTime, endTime: defaultSameDayEndTime(startTime) };
  }
  return { startTime: DEFAULT_STAY_ARRIVAL, endTime: DEFAULT_STAY_DEPARTURE };
}

export function localRangeFromDates(
  startDate: Date,
  endDate: Date,
  startTime: string,
  endTime: string,
): { startLocal: string; endLocal: string } {
  return {
    startLocal: combineDateAndTimeLocal(startDate, startTime),
    endLocal: combineDateAndTimeLocal(endDate, endTime),
  };
}

export function formatRangeTriggerLabel(startDate: Date | null, endDate: Date | null): string {
  if (!startDate) return "Choisir une plage de dates";
  const startFmt = startDate.toLocaleDateString("fr-FR");
  if (!endDate) return `Début : ${startFmt}`;
  if (isSameDay(startDate, endDate)) return startFmt;
  return `Du ${startFmt} au ${endDate.toLocaleDateString("fr-FR")}`;
}
