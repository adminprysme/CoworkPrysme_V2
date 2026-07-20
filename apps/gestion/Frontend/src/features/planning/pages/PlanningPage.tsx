import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PlanningBuildingOption,
  PlanningCalendarResponse,
  PlanningViewMode,
} from "@coworkprysme/shared";

import { fetchPlanningCalendar } from "../../../lib/planning-api.js";
import { PlanningCalendar } from "../components/PlanningCalendar.js";
import { PlanningToolbar } from "../components/PlanningToolbar.js";
import { ReservationDetailDrawer } from "../components/ReservationDetailDrawer.js";
import { SpaceHistoryDrawer } from "../components/SpaceHistoryDrawer.js";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

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

  // Keep catalog of all buildings when filter is applied (fetch once without filter if needed)
  useEffect(() => {
    if (buildingsCatalog.length > 0) return;
    void fetchPlanningCalendar({
      from: apiFrom.toISOString(),
      to: apiTo.toISOString(),
    })
      .then((payload) => setBuildingsCatalog(payload.buildings))
      .catch(() => {
        /* ignore — toolbar still works with current payload buildings */
      });
  }, [buildingsCatalog.length, apiFrom, apiTo]);

  const buildingsForFilter =
    buildingsCatalog.length > 0 ? buildingsCatalog : (data?.buildings ?? []);

  return (
    <div className={styles.page}>
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

      <PlanningCalendar
        mode={mode}
        from={displayFrom}
        to={displayTo}
        spaces={data?.spaces ?? []}
        reservations={data?.reservations ?? []}
        closures={data?.closures ?? []}
        onReservationClick={setSelectedReservationId}
        onSpaceNameClick={setSelectedSpaceId}
      />

      {selectedReservationId ? (
        <ReservationDetailDrawer
          reservationId={selectedReservationId}
          onClose={() => setSelectedReservationId(null)}
        />
      ) : null}

      {selectedSpaceId ? (
        <SpaceHistoryDrawer
          spaceId={selectedSpaceId}
          onClose={() => setSelectedSpaceId(null)}
          onOpenReservation={(reservationId) => {
            setSelectedSpaceId(null);
            setSelectedReservationId(reservationId);
          }}
        />
      ) : null}
    </div>
  );
}
