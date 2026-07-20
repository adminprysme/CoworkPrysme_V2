import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ReservationDetailDrawer } from "../components/ReservationDetailDrawer.js";
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
import styles from "./PlanningPage.module.css";

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
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [hoveredReservation, setHoveredReservation] = useState<PlanningCalendarReservation | null>(
    null,
  );
  const [hoverAnchor, setHoverAnchor] = useState<DOMRect | null>(null);
  const [hoverMeta, setHoverMeta] = useState<{ spaceType?: PlanningSpaceType } | null>(null);

  const [typeFilter, setTypeFilter] = useState<PlanningTypeFilter>("all");
  const [paymentStatuses, setPaymentStatuses] =
    useState<PlanningPaymentStatusFilter>(emptyPaymentStatusFilter);
  const [withReservationsOnly, setWithReservationsOnly] = useState(false);
  const [spaceSort, setSpaceSort] = useState<PlanningSpaceSort>("name_asc");

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchPlanningCalendar({
        from: apiFrom.toISOString(),
        to: apiTo.toISOString(),
        buildingId: buildingId === "all" ? undefined : buildingId,
      });
      setData(payload);
      setBuildingsCatalog((current) => {
        if (current.length > 0) return current;
        return payload.buildings;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le planning");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiFrom, apiTo, buildingId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    setOccupancyLoading(true);
    void fetchPlanningOccupancy()
      .then((payload) => {
        if (!cancelled) {
          setOccupancy(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOccupancy(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOccupancyLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const buildingsForFilter =
    buildingsCatalog.length > 0 ? buildingsCatalog : (data?.buildings ?? []);

  const filteredSpaces = useMemo(() => {
    const fromMs = displayFrom.getTime();
    const toMs = displayTo.getTime();
    const reservations = data?.reservations ?? [];
    let spaces = filterPlanningSpacesByType(data?.spaces ?? [], typeFilter);

    const paymentScopedReservations = !isPaymentStatusFilterActive(paymentStatuses)
      ? reservations
      : reservations.filter((reservation) => paymentStatuses.has(reservation.paymentStatus));

    if (isPaymentStatusFilterActive(paymentStatuses)) {
      const spaceIdsWithMatch = new Set(paymentScopedReservations.map((r) => r.spaceId));
      spaces = spaces.filter((space) => spaceIdsWithMatch.has(space.id));
    }

    if (withReservationsOnly) {
      spaces = filterSpacesWithReservationsInRange(spaces, paymentScopedReservations, fromMs, toMs);
    }

    return sortPlanningSpaces(spaces, reservations, spaceSort, fromMs, toMs);
  }, [
    data?.spaces,
    data?.reservations,
    typeFilter,
    paymentStatuses,
    withReservationsOnly,
    spaceSort,
    displayFrom,
    displayTo,
  ]);

  const filteredReservations = useMemo(() => {
    const spaceIds = new Set(filteredSpaces.map((space) => space.id));
    return (data?.reservations ?? []).filter((reservation) => {
      if (!spaceIds.has(reservation.spaceId)) return false;
      if (
        isPaymentStatusFilterActive(paymentStatuses) &&
        !paymentStatuses.has(reservation.paymentStatus)
      ) {
        return false;
      }
      return true;
    });
  }, [data?.reservations, filteredSpaces, paymentStatuses]);

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

  const handleReservationHover = useCallback(
    (
      reservation: PlanningCalendarReservation | null,
      anchorRect: DOMRect | null,
      spaceType?: PlanningSpaceType,
    ) => {
      setHoveredReservation(reservation);
      setHoverAnchor(anchorRect);
      setHoverMeta(reservation ? { spaceType } : null);
    },
    [],
  );

  function openReservation(reservationId: string) {
    setSelectedSpaceId(null);
    setSelectedReservationId(reservationId);
  }

  function openSpaceHistory(spaceId: string) {
    setSelectedReservationId(null);
    setSelectedSpaceId(spaceId);
  }

  function closeDetailPanel() {
    setSelectedReservationId(null);
    setSelectedSpaceId(null);
  }

  function resetFilters() {
    setTypeFilter("all");
    setPaymentStatuses(emptyPaymentStatusFilter());
    setWithReservationsOnly(false);
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

  return (
    <div className={styles.page} data-split={splitOpen ? "true" : undefined}>
      <div className={styles.topStack}>
        <header className={styles.header}>
          <div className={styles.headerIntro}>
            <h1>Planning</h1>
            <p className={styles.subtitle}>
              Vue d&apos;ensemble des réservations, disponibilités et occupation en temps réel.
            </p>
          </div>
        </header>

        <div className={styles.kpiStrip}>
          <PlanningOccupancyStats occupancy={occupancy} loading={occupancyLoading} />
        </div>

        <div className={styles.separator} role="separator" />

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
          sort={spaceSort}
          onTypeChange={setTypeFilter}
          onPaymentStatusesChange={setPaymentStatuses}
          onWithReservationsOnlyChange={setWithReservationsOnly}
          onSortChange={setSpaceSort}
          onReset={resetFilters}
          searchSlot={<PlanningSearch onSelect={handleSearchSelect} />}
        />
      </div>

      <div className={styles.workspace}>
        <div className={styles.calendarPane}>
          <PlanningCalendar
            mode={mode}
            from={displayFrom}
            to={displayTo}
            spaces={filteredSpaces}
            reservations={filteredReservations}
            closures={filteredClosures}
            selectedReservationId={selectedReservationId}
            onReservationClick={openReservation}
            onSpaceNameClick={openSpaceHistory}
            onReservationHover={handleReservationHover}
          />
        </div>

        {selectedReservationId ? (
          <div className={styles.detailPane}>
            <ReservationDetailDrawer
              reservationId={selectedReservationId}
              onClose={closeDetailPanel}
            />
          </div>
        ) : selectedSpaceId ? (
          <div className={styles.detailPane}>
            <SpaceHistoryDrawer
              spaceId={selectedSpaceId}
              onClose={closeDetailPanel}
              onOpenReservation={openReservation}
            />
          </div>
        ) : null}
      </div>

      <ReservationTooltip reservation={hoveredReservation} anchor={hoverAnchor} meta={hoverMeta} />
    </div>
  );
}
