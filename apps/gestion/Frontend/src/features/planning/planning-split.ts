import type { PlanningViewMode } from "@coworkprysme/shared";

/** Detail pane share of the split workspace (0–1). Default = 30% detail / 70% planning. */
export const PLANNING_SPLIT_DEFAULT_DETAIL_RATIO = 0.3;

export const PLANNING_SPLIT_STORAGE_KEY = "coworkprysme.planning.splitDetailRatio";

/** Detail column must stay wide enough for amount cards. */
export const PLANNING_SPLIT_DETAIL_MIN_PX = 320;

/**
 * Absolute floor for the planning column (ESPACE label + a couple of day cols).
 * Dynamic track mins (see `planningCalendarMinPx`) usually raise this further.
 */
export const PLANNING_SPLIT_CALENDAR_MIN_PX = 300;

/** Hard cap: detail must not claim more than this share of the workspace. */
export const PLANNING_SPLIT_DETAIL_MAX_RATIO = 0.55;

/** Matches PlanningCalendar sticky label floor (`clamp(120px, 16vw, 180px)`). */
const PLANNING_LABEL_MIN_PX = 140;

const COL_MIN_WIDTH: Record<PlanningViewMode, number> = {
  month: 40,
  week: 72,
  day: 48,
};

const RATIO_FLOOR = 0.18;
const RATIO_CEIL = PLANNING_SPLIT_DETAIL_MAX_RATIO;

export function planningCalendarMinPx(mode: PlanningViewMode, columnCount: number): number {
  const cols = Math.max(1, columnCount);
  return PLANNING_LABEL_MIN_PX + cols * COL_MIN_WIDTH[mode];
}

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

export function clampDetailRatio(
  ratio: number,
  workspaceWidthPx?: number,
  calendarMinPx: number = PLANNING_SPLIT_CALENDAR_MIN_PX,
): number {
  let min = RATIO_FLOOR;
  let max = RATIO_CEIL;
  if (workspaceWidthPx && workspaceWidthPx > 0) {
    const calendarFloor = Math.max(PLANNING_SPLIT_CALENDAR_MIN_PX, calendarMinPx);
    min = Math.max(min, PLANNING_SPLIT_DETAIL_MIN_PX / workspaceWidthPx);
    max = Math.min(max, 1 - calendarFloor / workspaceWidthPx);
    if (min > max) {
      return PLANNING_SPLIT_DEFAULT_DETAIL_RATIO;
    }
  }
  return Math.min(max, Math.max(min, ratio));
}
