const MONTH_ABBREV: Record<string, string> = {
  janvier: "janv.",
  fevrier: "févr.",
  mars: "mars",
  avril: "avr.",
  mai: "mai",
  juin: "juin",
  juillet: "juil.",
  aout: "août",
  septembre: "sept.",
  octobre: "oct.",
  novembre: "nov.",
  decembre: "déc.",
};

function normalizeMonthKey(raw: string): string {
  return raw.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function abbreviateMonth(raw: string): string {
  const key = normalizeMonthKey(raw);
  for (const [full, short] of Object.entries(MONTH_ABBREV)) {
    if (key === full || key.startsWith(full.slice(0, 4))) {
      return short;
    }
  }
  return `${raw.slice(0, 4)}.`;
}

/** Compact period for tight mobile KPI cards (375px). */
export function compactOccupancyPeriodLabel(
  key: "day" | "week" | "month",
  periodLabel: string,
): string {
  const text = periodLabel.trim();
  if (key === "week") {
    const sameMonth = text.match(/Semaine du (\d+) au (\d+)\s+([A-Za-zÀ-ÿ]+)/i);
    if (sameMonth) {
      return `Sem. ${sameMonth[1]}-${sameMonth[2]} ${abbreviateMonth(sameMonth[3]!)}`;
    }
    const cross = text.match(/Semaine du (\d+)\s+([A-Za-zÀ-ÿ]+).*?au (\d+)\s+([A-Za-zÀ-ÿ]+)/i);
    if (cross) {
      return `Sem. ${cross[1]} ${abbreviateMonth(cross[2]!)}-${cross[3]} ${abbreviateMonth(cross[4]!)}`;
    }
  }
  if (key === "day") {
    const match = text.match(/(\d+)\s+([A-Za-zÀ-ÿ]+)/);
    if (match) {
      return `${match[1]} ${abbreviateMonth(match[2]!)}`;
    }
  }
  if (key === "month") {
    const match = text.match(/^([A-Za-zÀ-ÿ]+)\s+(\d{4})$/i);
    if (match) {
      return `${abbreviateMonth(match[1]!)} ${match[2]}`;
    }
  }
  return text;
}
