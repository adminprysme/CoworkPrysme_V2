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
  const start = new Date(startAt);
  const end = new Date(endAt);
  const sameDay = isSameDay(start, end);

  const dateLabel = start.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const startTime = start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const endTime = end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  if (sameDay) {
    return `${dateLabel} · ${startTime} → ${endTime}`;
  }

  const endDateLabel = end.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  return `${dateLabel} ${startTime} → ${endDateLabel} ${endTime}`;
}

export function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

export function addDays(date: Date, count: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}
