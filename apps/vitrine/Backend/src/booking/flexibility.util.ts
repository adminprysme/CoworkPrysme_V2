/** Day offsets from -N to +N inclusive. */
export function buildFlexibilityOffsets(flexibilityDays: number): number[] {
  const offsets: number[] = [];
  for (let offset = -flexibilityDays; offset <= flexibilityDays; offset += 1) {
    offsets.push(offset);
  }
  return offsets;
}

export function shiftInstantByDays(instant: Date, dayOffset: number): Date {
  return new Date(instant.getTime() + dayOffset * 24 * 60 * 60 * 1000);
}

export interface BookingTimeWindow {
  startAt: string;
  endAt: string;
}

/** Deduplicates windows by start/end ISO pair, sorted by startAt. */
export function mergeAvailabilityWindows(windows: BookingTimeWindow[]): BookingTimeWindow[] {
  const seen = new Set<string>();
  const unique: BookingTimeWindow[] = [];

  for (const window of windows) {
    const key = `${window.startAt}|${window.endAt}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(window);
  }

  return unique.sort(
    (left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
  );
}
