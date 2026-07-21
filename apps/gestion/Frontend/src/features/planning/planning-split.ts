/** Detail pane share of the split workspace (0–1). Default = 40% detail / 60% planning. */
export const PLANNING_SPLIT_DEFAULT_DETAIL_RATIO = 0.4;

export const PLANNING_SPLIT_STORAGE_KEY = "coworkprysme.planning.splitDetailRatio";

/** Detail column must stay wide enough for amount cards. */
export const PLANNING_SPLIT_DETAIL_MIN_PX = 320;

/**
 * Planning column: sticky ESPACE label (~120–180px) + ~2 week day cols (72px).
 * Keeps the grid usable when the detail pane is widened.
 */
export const PLANNING_SPLIT_CALENDAR_MIN_PX = 300;

const RATIO_FLOOR = 0.18;
const RATIO_CEIL = 0.82;

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
