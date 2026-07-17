const PARIS_TZ = "Europe/Paris";

function parisCalendarDayKey(date: Date): string {
  return date.toLocaleDateString("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Booking window label used in the vitrine calendar / summaries, e.g.
 * `jeu. 16 juil. 08:00 → sam. 18 juil. 19:00` or same-day `jeu. 16 juil. · 08:00 → 19:00`.
 * Times are always shown (hourly and daily slots both have meaningful Paris local hours).
 */
export function formatAvailabilityWindow(startAt: string | Date, endAt: string | Date): string {
  const start = startAt instanceof Date ? startAt : new Date(startAt);
  const end = endAt instanceof Date ? endAt : new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "";
  }

  const dateLabel = start.toLocaleDateString("fr-FR", {
    timeZone: PARIS_TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const startTime = start.toLocaleTimeString("fr-FR", {
    timeZone: PARIS_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = end.toLocaleTimeString("fr-FR", {
    timeZone: PARIS_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });

  if (parisCalendarDayKey(start) === parisCalendarDayKey(end)) {
    return `${dateLabel} · ${startTime} → ${endTime}`;
  }

  const endDateLabel = end.toLocaleDateString("fr-FR", {
    timeZone: PARIS_TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  return `${dateLabel} ${startTime} → ${endDateLabel} ${endTime}`;
}
