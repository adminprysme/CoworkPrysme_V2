/** Detail pane share of the split workspace (0–1). Default = 30% detail / 70% planning. */
export const PLANNING_SPLIT_DEFAULT_DETAIL_RATIO = 0.3;

export const PLANNING_SPLIT_STORAGE_KEY = "coworkprysme.planning.splitDetailRatio";

/** Detail column must stay wide enough for amount cards. */
export const PLANNING_SPLIT_DETAIL_MIN_PX = 320;

/**
 * Planning column floor: sticky ESPACE label + ~3 day columns.
 * The calendar already has its own horizontal scroll for denser views (month);
 * we must NOT reserve width for every day column of the active view.
 */
export const PLANNING_SPLIT_CALENDAR_MIN_PX = 400;

/** Hard cap on detail share — same for Jour / Semaine / Mois. */
export const PLANNING_SPLIT_DETAIL_MAX_RATIO = 0.65;

const RATIO_FLOOR = 0.18;
const RATIO_CEIL = PLANNING_SPLIT_DETAIL_MAX_RATIO;

export function readStoredDetailRatio(): number {
  try {
    const raw = localStorage.getItem(PLANNING_SPLIT_STORAGE_KEY);
    if (raw == null) return PLANNING_SPLIT_DEFAULT_DETAIL_RATIO;
    const value = Number(raw);
    if (!Number.isFinite(value)) return PLANNING_SPLIT_DEFAULT_DETAIL_RATIO;
    return clampDetailRatio(value);
  } catch {
    return PLANNING_SPLIT_DEFAULT_DETAIL_RATIO;
  }
}

export function persistDetailRatio(ratio: number): void {
  try {
    localStorage.setItem(PLANNING_SPLIT_STORAGE_KEY, String(clampDetailRatio(ratio)));
  } catch {
    /* private mode / quota — ignore */
  }
}

export function clampDetailRatio(ratio: number, workspaceWidthPx?: number): number {
  let min = RATIO_FLOOR;
  let max = RATIO_CEIL;
  if (workspaceWidthPx && workspaceWidthPx > 0) {
    min = Math.max(min, PLANNING_SPLIT_DETAIL_MIN_PX / workspaceWidthPx);
    max = Math.min(max, 1 - PLANNING_SPLIT_CALENDAR_MIN_PX / workspaceWidthPx);
    if (min > max) {
      return PLANNING_SPLIT_DEFAULT_DETAIL_RATIO;
    }
  }
  return Math.min(max, Math.max(min, ratio));
}
