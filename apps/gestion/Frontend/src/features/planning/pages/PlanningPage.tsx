import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  PlanningBuildingOption,
  PlanningCalendarReservation,
  PlanningCalendarResponse,
  PlanningOccupancyResponse,
  PlanningSearchHit,
  PlanningSpaceType,
  PlanningViewMode,
} from "@coworkprysme/shared";

import { fetchPlanningCalendar, fetchPlanningOccupancy } from "../../../lib/planning-api.js";
import { PlanningCalendar } from "../components/PlanningCalendar.js";
import { PlanningFiltersBar } from "../components/PlanningFiltersBar.js";
import { PlanningOccupancyStats } from "../components/PlanningOccupancyStats.js";
import { PlanningSearch } from "../components/PlanningSearch.js";
import { PlanningToolbar } from "../components/PlanningToolbar.js";
import {
  ReservationDetailDrawer,
  type PlanningDrawerTab,
} from "../components/ReservationDetailDrawer.js";
import {
  ReservationContextMenu,
  type ReservationContextMenuState,
} from "../components/ReservationContextMenu.js";
import { ReservationTooltip } from "../components/ReservationTooltip.js";
import { SpaceHistoryDrawer } from "../components/SpaceHistoryDrawer.js";
import {
  emptyPaymentStatusFilter,
  filterPlanningSpacesByType,
  filterSpacesWithReservationsInRange,
  isPaymentStatusFilterActive,
  type PlanningPaymentStatusFilter,
  type PlanningTypeFilter,
} from "../planning-filters.js";
import { sortPlanningSpaces, type PlanningSpaceSort } from "../planning-sort.js";
import {
  addDays,
  formatRangeLabel,
  rangeForView,
  shiftAnchor,
  startOfDay,
} from "../planning-utils.js";
import {
  clampDetailRatio,
  persistDetailRatio,
  PLANNING_SPLIT_DEFAULT_DETAIL_RATIO,
  readStoredDetailRatio,
} from "../planning-split.js";
import styles from "./PlanningPage.module.css";

const SPLIT_DESKTOP_MQ = "(min-width: 1025px)";

export function PlanningPage() {
  const [mode, setMode] = useState<PlanningViewMode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [buildingId, setBuildingId] = useState<string | "all">("all");
  const [buildingsCatalog, setBuildingsCatalog] = useState<PlanningBuildingOption[]>([]);
  const [data, setData] = useState<PlanningCalendarResponse | null>(null);
  const [occupancy, setOccupancy] = useState<PlanningOccupancyResponse | null>(null);
  const [occupancyLoading, setOccupancyLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [selectedReservationTab, setSelectedReservationTab] =
    useState<PlanningDrawerTab>("summary");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [hoveredReservation, setHoveredReservation] = useState<PlanningCalendarReservation | null>(
    null,
  );
  const [hoverAnchor, setHoverAnchor] = useState<DOMRect | null>(null);
  const [hoverMeta, setHoverMeta] = useState<{ spaceType?: PlanningSpaceType } | null>(null);
  const [contextMenu, setContextMenu] = useState<ReservationContextMenuState | null>(null);

  const [typeFilter, setTypeFilter] = useState<PlanningTypeFilter>("all");
  const [paymentStatuses, setPaymentStatuses] =
    useState<PlanningPaymentStatusFilter>(emptyPaymentStatusFilter);
  const [withReservationsOnly, setWithReservationsOnly] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [spaceSort, setSpaceSort] = useState<PlanningSpaceSort>("name_asc");
  const [detailRatio, setDetailRatio] = useState(readStoredDetailRatio);
  const [desktopSplit, setDesktopSplit] = useState(
    () => typeof window !== "undefined" && window.matchMedia(SPLIT_DESKTOP_MQ).matches,
  );
  const [splitDragging, setSplitDragging] = useState(false);
  const [detailFullscreen, setDetailFullscreen] = useState(false);
  /** Monotonic id so overlapping calendar fetches cannot apply stale payloads. */
  const calendarLoadSeq = useRef(0);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const detailRatioRef = useRef(detailRatio);
  detailRatioRef.current = detailRatio;

  const { from: displayFrom, to: displayTo } = useMemo(
    () => rangeForView(anchor, mode),
    [anchor, mode],
  );
  const { apiFrom, apiTo } = useMemo(() => {
    if (mode !== "day") {
      return { apiFrom: displayFrom, apiTo: displayTo };
    }
    const dayStart = startOfDay(anchor);
    return { apiFrom: dayStart, apiTo: addDays(dayStart, 1) };
  }, [anchor, mode, displayFrom, displayTo]);
  const rangeLabel = useMemo(() => formatRangeLabel(anchor, mode), [anchor, mode]);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      const requestId = ++calendarLoadSeq.current;
      if (!options?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const payload = await fetchPlanningCalendar({
          from: apiFrom.toISOString(),
          to: apiTo.toISOString(),
          buildingId: buildingId === "all" ? undefined : buildingId,
        });
        // Drop stale responses — cancel→restore (or rapid filter changes) can
        // otherwise re-apply an older `cancelled` payload after a newer one.
        if (requestId !== calendarLoadSeq.current) {
          return;
        }
        setData(payload);
        setBuildingsCatalog((current) => {
          if (current.length > 0) return current;
          return payload.buildings;
        });
      } catch (err) {
        if (requestId !== calendarLoadSeq.current) {
          return;
        }
        if (!options?.silent) {
          setError(err instanceof Error ? err.message : "Impossible de charger le planning");
          setData(null);
        }
      } finally {
        if (!options?.silent && requestId === calendarLoadSeq.current) {
          setLoading(false);
        }
      }
    },
    [apiFrom, apiTo, buildingId],
  );

  const loadOccupancy = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setOccupancyLoading(true);
    }
    try {
      const payload = await fetchPlanningOccupancy();
      setOccupancy(payload);
    } catch {
      if (!options?.silent) {
        setOccupancy(null);
      }
    } finally {
      if (!options?.silent) {
        setOccupancyLoading(false);
      }
    }
  }, []);

  /** After Manage mutations (restore, cancel, space change): refresh grid without full reload flash. */
  const refreshAfterReservationMutation = useCallback(() => {
    void load({ silent: true });
    void loadOccupancy({ silent: true });
    setHoveredReservation(null);
    setHoverAnchor(null);
    setHoverMeta(null);
  }, [load, loadOccupancy]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadOccupancy();
  }, [loadOccupancy]);

  useEffect(() => {
    if (buildingsCatalog.length > 0) return;
    void fetchPlanningCalendar({
      from: apiFrom.toISOString(),
      to: apiTo.toISOString(),
    })
      .then((payload) => setBuildingsCatalog(payload.buildings))
      .catch(() => {
        /* ignore */
      });
  }, [buildingsCatalog.length, apiFrom, apiTo]);

  useEffect(() => {
    const media = window.matchMedia(SPLIT_DESKTOP_MQ);
    function sync() {
      setDesktopSplit(media.matches);
    }
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!desktopSplit) {
      setDetailFullscreen(false);
    }
  }, [desktopSplit]);

  useEffect(() => {
    if (!splitDragging) return;
    const previous = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = previous;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [splitDragging]);

  const buildingsForFilter =
    buildingsCatalog.length > 0 ? buildingsCatalog : (data?.buildings ?? []);

  const filteredSpaces = useMemo(() => {
    const fromMs = displayFrom.getTime();
    const toMs = displayTo.getTime();
    const reservations = data?.reservations ?? [];
    let spaces = filterPlanningSpacesByType(data?.spaces ?? [], typeFilter);

    const visibleReservations = reservations.filter((reservation) => {
      if (reservation.status === "cancelled") {
        return showCancelled;
      }
      if (
        isPaymentStatusFilterActive(paymentStatuses) &&
        !paymentStatuses.has(reservation.paymentStatus)
      ) {
        return false;
      }
      return true;
    });

    if (isPaymentStatusFilterActive(paymentStatuses)) {
      const spaceIdsWithMatch = new Set(visibleReservations.map((r) => r.spaceId));
      spaces = spaces.filter((space) => spaceIdsWithMatch.has(space.id));
    }

    if (withReservationsOnly) {
      spaces = filterSpacesWithReservationsInRange(spaces, visibleReservations, fromMs, toMs);
    }

    return sortPlanningSpaces(spaces, reservations, spaceSort, fromMs, toMs);
  }, [
    data?.spaces,
    data?.reservations,
    typeFilter,
    paymentStatuses,
    withReservationsOnly,
    showCancelled,
    spaceSort,
    displayFrom,
    displayTo,
  ]);

  const filteredReservations = useMemo(() => {
    const spaceIds = new Set(filteredSpaces.map((space) => space.id));
    return (data?.reservations ?? []).filter((reservation) => {
      if (!spaceIds.has(reservation.spaceId)) return false;
      if (reservation.status === "cancelled") {
        return showCancelled;
      }
      if (
        isPaymentStatusFilterActive(paymentStatuses) &&
        !paymentStatuses.has(reservation.paymentStatus)
      ) {
        return false;
      }
      return true;
    });
  }, [data?.reservations, filteredSpaces, paymentStatuses, showCancelled]);

  const filteredClosures = useMemo(() => {
    const spaceIds = new Set(filteredSpaces.map((space) => space.id));
    return (data?.closures ?? []).filter((closure) => {
      if (closure.spaceId) {
        return spaceIds.has(closure.spaceId);
      }
      if (typeFilter !== "all" && closure.spaceType && closure.spaceType !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [data?.closures, filteredSpaces, typeFilter]);

  const splitOpen = Boolean(selectedReservationId || selectedSpaceId);

  useEffect(() => {
    if (!splitOpen || !desktopSplit) return;
    function onResize() {
      const width = workspaceRef.current?.getBoundingClientRect().width;
      setDetailRatio((current) => clampDetailRatio(current, width));
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [splitOpen, desktopSplit]);

  const handleReservationHover = useCallback(
    (
      reservation: PlanningCalendarReservation | null,
      anchorRect: DOMRect | null,
      spaceType?: PlanningSpaceType,
    ) => {
      // Hide tooltip whenever a blocking UI is open (context menu or detail panel).
      if (contextMenu || selectedReservationId || selectedSpaceId) {
        return;
      }
      setHoveredReservation(reservation);
      setHoverAnchor(anchorRect);
      setHoverMeta(reservation ? { spaceType } : null);
    },
    [contextMenu, selectedReservationId, selectedSpaceId],
  );

  const clearReservationHover = useCallback(() => {
    setHoveredReservation(null);
    setHoverAnchor(null);
    setHoverMeta(null);
  }, []);

  const handleReservationContextMenu = useCallback(
    (reservation: PlanningCalendarReservation, clientX: number, clientY: number) => {
      clearReservationHover();
      setContextMenu({ reservation, x: clientX, y: clientY });
    },
    [clearReservationHover],
  );

  function openReservation(reservationId: string, tab: PlanningDrawerTab = "summary") {
    clearReservationHover();
    setSelectedSpaceId(null);
    setSelectedReservationTab(tab);
    setSelectedReservationId(reservationId);
    setContextMenu(null);
  }

  function openSpaceHistory(spaceId: string) {
    clearReservationHover();
    setSelectedReservationId(null);
    setSelectedSpaceId(spaceId);
    setContextMenu(null);
  }

  function closeDetailPanel() {
    setSelectedReservationId(null);
    setSelectedSpaceId(null);
    setSelectedReservationTab("summary");
    setDetailFullscreen(false);
  }

  function resetFilters() {
    setTypeFilter("all");
    setPaymentStatuses(emptyPaymentStatusFilter());
    setWithReservationsOnly(false);
    setShowCancelled(false);
  }

  function handleSearchSelect(hit: PlanningSearchHit) {
    const start = new Date(hit.startAt);
    const end = new Date(hit.endAt);
    const inRange = start.getTime() < displayTo.getTime() && end.getTime() > displayFrom.getTime();
    if (!inRange) {
      const durationMs = end.getTime() - start.getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      setMode(durationMs <= dayMs ? "day" : "week");
      setAnchor(start);
    }
    openReservation(hit.reservationId);
  }

  function applyDetailRatio(next: number, workspaceWidth?: number) {
    const width = workspaceWidth ?? workspaceRef.current?.getBoundingClientRect().width;
    const clamped = clampDetailRatio(next, width);
    setDetailRatio(clamped);
    return clamped;
  }

  function resetSplitRatio() {
    const next = applyDetailRatio(PLANNING_SPLIT_DEFAULT_DETAIL_RATIO);
    persistDetailRatio(next);
  }

  function onSplitPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!desktopSplit || event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    setSplitDragging(true);

    const onMove = (moveEvent: PointerEvent) => {
      const workspace = workspaceRef.current;
      if (!workspace) return;
      const rect = workspace.getBoundingClientRect();
      if (rect.width <= 0) return;
      const detailPx = rect.right - moveEvent.clientX;
      applyDetailRatio(detailPx / rect.width, rect.width);
    };

    const onUp = (upEvent: PointerEvent) => {
      handle.releasePointerCapture(upEvent.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      setSplitDragging(false);
      persistDetailRatio(detailRatioRef.current);
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  const showSplitHandle = splitOpen && desktopSplit && !detailFullscreen;
  const workspaceStyle = showSplitHandle
    ? ({
        ["--planning-detail-ratio" as string]: `${(detailRatio * 100).toFixed(3)}%`,
      } as CSSProperties)
    : undefined;

  return (
    <div
      className={styles.page}
      data-split={splitOpen ? "true" : undefined}
      data-detail-fullscreen={detailFullscreen && desktopSplit ? "true" : undefined}
    >
      {" "}
      <div className={styles.topStack}>
        <header className={styles.header}>
          <div className={styles.headerIntro}>
            <h1>Planning</h1>
            <p className={styles.subtitle}>
              Vue d&apos;ensemble des réservations, disponibilités et occupation en temps réel.
            </p>
          </div>
          <div className={styles.kpiStrip}>
            <PlanningOccupancyStats occupancy={occupancy} loading={occupancyLoading} />
          </div>
        </header>

        <div className={styles.chromeBand} data-planning-chrome="">
          <PlanningToolbar
            mode={mode}
            rangeLabel={rangeLabel}
            buildings={buildingsForFilter}
            buildingId={buildingId}
            loading={loading}
            error={error}
            onModeChange={setMode}
            onPrev={() => setAnchor((current) => shiftAnchor(current, mode, -1))}
            onNext={() => setAnchor((current) => shiftAnchor(current, mode, 1))}
            onToday={() => setAnchor(new Date())}
            onBuildingChange={setBuildingId}
          />

          <PlanningFiltersBar
            typeFilter={typeFilter}
            paymentStatuses={paymentStatuses}
            withReservationsOnly={withReservationsOnly}
            showCancelled={showCancelled}
            sort={spaceSort}
            onTypeChange={setTypeFilter}
            onPaymentStatusesChange={setPaymentStatuses}
            onWithReservationsOnlyChange={setWithReservationsOnly}
            onShowCancelledChange={setShowCancelled}
            onSortChange={setSpaceSort}
            onReset={resetFilters}
            searchSlot={<PlanningSearch onSelect={handleSearchSelect} />}
          />
        </div>
      </div>
      <div
        ref={workspaceRef}
        className={styles.workspace}
        data-resizable={showSplitHandle ? "true" : undefined}
        data-dragging={splitDragging ? "true" : undefined}
        style={workspaceStyle}
      >
        <div className={styles.calendarPane}>
          <PlanningCalendar
            mode={mode}
            from={displayFrom}
            to={displayTo}
            spaces={filteredSpaces}
            reservations={filteredReservations}
            closures={filteredClosures}
            selectedReservationId={selectedReservationId}
            onReservationClick={(id) => openReservation(id, "summary")}
            onSpaceNameClick={openSpaceHistory}
            onReservationHover={handleReservationHover}
            onReservationContextMenu={handleReservationContextMenu}
          />
        </div>

        {showSplitHandle ? (
          <div
            className={styles.splitHandle}
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionner le panneau détail"
            aria-valuenow={Math.round(detailRatio * 100)}
            aria-valuemin={18}
            aria-valuemax={82}
            tabIndex={0}
            onPointerDown={onSplitPointerDown}
            onDoubleClick={resetSplitRatio}
          />
        ) : null}

        {selectedReservationId ? (
          <div
            className={styles.detailPane}
            data-fullscreen={detailFullscreen && desktopSplit ? "true" : undefined}
          >
            <ReservationDetailDrawer
              key={`${selectedReservationId}:${selectedReservationTab}`}
              reservationId={selectedReservationId}
              initialTab={selectedReservationTab}
              onClose={closeDetailPanel}
              onOpenReservation={(id) => openReservation(id, "summary")}
              onReservationMutated={refreshAfterReservationMutation}
              fullscreen={detailFullscreen}
              showFullscreenToggle={desktopSplit}
              onToggleFullscreen={() => setDetailFullscreen((current) => !current)}
            />
          </div>
        ) : selectedSpaceId ? (
          <div className={styles.detailPane}>
            <SpaceHistoryDrawer
              spaceId={selectedSpaceId}
              onClose={closeDetailPanel}
              onOpenReservation={(id) => openReservation(id, "summary")}
            />
          </div>
        ) : null}
      </div>
      {!contextMenu && !splitOpen ? (
        <ReservationTooltip
          reservation={hoveredReservation}
          anchor={hoverAnchor}
          meta={hoverMeta}
        />
      ) : null}
      <ReservationContextMenu
        state={contextMenu}
        onClose={() => setContextMenu(null)}
        onOpenDetails={openReservation}
      />
    </div>
  );
}
