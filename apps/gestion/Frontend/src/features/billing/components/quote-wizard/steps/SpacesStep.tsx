import { useEffect, useMemo, useRef, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import type { BuildingResponse, SpaceResponse } from "@coworkprysme/shared";

import { checkQuoteAvailability } from "../../../../../lib/billing-quotes-api.js";
import pageStyles from "../../../BillingPages.module.css";
import type { WizardSpaceSlot } from "../../../lib/quote-wizard-state.js";
import {
  fromDatetimeLocalValue,
  isWizardSpaceSlotComplete,
  newSlotKey,
} from "../../../lib/quote-wizard-state.js";
import { QuoteDurationRangeField } from "../QuoteDurationRangeField.js";
import { QuoteSpaceCard } from "../QuoteSpaceCard.js";
import { SpaceDetailPanel } from "../SpaceDetailPanel.js";
import styles from "../QuoteWizard.module.css";

const AVAILABILITY_CHUNK_SIZE = 20;
const AVAILABILITY_DEBOUNCE_MS = 450;

type SpacesStepProps = {
  slots: WizardSpaceSlot[];
  buildings: BuildingResponse[];
  spacesByBuilding: Map<string, SpaceResponse[]>;
  locksExpiresAt: string | null;
  checkingAvailability?: boolean;
  quoteDraftId?: string | null;
  onChange: (slots: WizardSpaceSlot[]) => void;
};

type CatalogEntry = {
  space: SpaceResponse;
  building: BuildingResponse | undefined;
};

function isTopPeriodReady(startLocal: string, endLocal: string, partySize: number): boolean {
  const startAt = fromDatetimeLocalValue(startLocal);
  const endAt = fromDatetimeLocalValue(endLocal);
  if (!startAt || !endAt) return false;
  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) return false;
  if (!Number.isFinite(partySize) || partySize < 1) return false;
  return true;
}

export function SpacesStep({
  slots,
  buildings,
  spacesByBuilding,
  locksExpiresAt,
  checkingAvailability = false,
  quoteDraftId = null,
  onChange,
}: SpacesStepProps) {
  const [search, setSearch] = useState("");
  const [minCapacity, setMinCapacity] = useState(0);
  const [buildingFilter, setBuildingFilter] = useState("");
  const [focusedSpaceId, setFocusedSpaceId] = useState<string | null>(null);

  const [periodStartLocal, setPeriodStartLocal] = useState("");
  const [periodEndLocal, setPeriodEndLocal] = useState("");
  const [periodPartySize, setPeriodPartySize] = useState(1);
  const [availableSpaceIds, setAvailableSpaceIds] = useState<Set<string> | null>(null);
  const [filteringAvailability, setFilteringAvailability] = useState(false);
  const filterGenerationRef = useRef(0);

  const periodReady = isTopPeriodReady(periodStartLocal, periodEndLocal, periodPartySize);

  const buildingById = useMemo(() => {
    const map = new Map<string, BuildingResponse>();
    for (const building of buildings) map.set(building.id, building);
    return map;
  }, [buildings]);

  const catalog = useMemo(() => {
    const entries: CatalogEntry[] = [];
    for (const [buildingId, spaces] of spacesByBuilding) {
      const building = buildingById.get(buildingId);
      for (const space of spaces) {
        if (space.status === "archived") continue;
        entries.push({ space, building });
      }
    }
    entries.sort((a, b) => {
      const buildingCmp = (a.building?.name ?? "").localeCompare(b.building?.name ?? "", "fr");
      if (buildingCmp !== 0) return buildingCmp;
      return a.space.name.localeCompare(b.space.name, "fr");
    });
    return entries;
  }, [spacesByBuilding, buildingById]);

  const buildingsInCatalog = useMemo(() => {
    const seen = new Map<string, BuildingResponse>();
    for (const entry of catalog) {
      if (entry.building && !seen.has(entry.building.id)) {
        seen.set(entry.building.id, entry.building);
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [catalog]);

  const showBuildingFilter = buildingsInCatalog.length > 1;

  // Capacity-eligible spaces for the top period (local filter before API).
  const capacityEligibleIds = useMemo(() => {
    if (!periodReady) return null;
    const ids = new Set<string>();
    for (const { space } of catalog) {
      if (space.capacity >= periodPartySize) ids.add(space.id);
    }
    return ids;
  }, [catalog, periodPartySize, periodReady]);

  useEffect(() => {
    if (!periodReady || !capacityEligibleIds) {
      filterGenerationRef.current += 1;
      setAvailableSpaceIds(null);
      setFilteringAvailability(false);
      return;
    }

    const startAt = fromDatetimeLocalValue(periodStartLocal);
    const endAt = fromDatetimeLocalValue(periodEndLocal);
    if (!startAt || !endAt) return;

    const candidates = [...capacityEligibleIds];
    const generation = ++filterGenerationRef.current;
    setAvailableSpaceIds(null);

    if (candidates.length === 0) {
      setAvailableSpaceIds(new Set());
      setFilteringAvailability(false);
      return;
    }

    setFilteringAvailability(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        const nextAvailable = new Set<string>();
        try {
          for (let offset = 0; offset < candidates.length; offset += AVAILABILITY_CHUNK_SIZE) {
            if (filterGenerationRef.current !== generation) return;
            const chunkIds = candidates.slice(offset, offset + AVAILABILITY_CHUNK_SIZE);
            const result = await checkQuoteAvailability({
              slots: chunkIds.map((spaceId) => ({
                spaceId,
                startAt,
                endAt,
                partySize: periodPartySize,
              })),
              ...(quoteDraftId ? { quoteDraftId } : {}),
            });
            if (filterGenerationRef.current !== generation) return;
            for (const item of result.results) {
              if (item.available) nextAvailable.add(item.spaceId);
            }
          }
          if (filterGenerationRef.current !== generation) return;
          setAvailableSpaceIds(nextAvailable);
        } catch {
          if (filterGenerationRef.current !== generation) return;
          // Soft fail: keep previous filter result; user can tweak period to retry.
        } finally {
          if (filterGenerationRef.current === generation) {
            setFilteringAvailability(false);
          }
        }
      })();
    }, AVAILABILITY_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      // Invalidate in-flight batches without racing the next effect's generation bump.
      if (filterGenerationRef.current === generation) {
        filterGenerationRef.current += 1;
      }
    };
  }, [
    capacityEligibleIds,
    periodEndLocal,
    periodPartySize,
    periodReady,
    periodStartLocal,
    quoteDraftId,
  ]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter(({ space, building }) => {
      if (buildingFilter && building?.id !== buildingFilter) return false;
      if (minCapacity > 0 && space.capacity < minCapacity) return false;
      if (periodReady) {
        if (space.capacity < periodPartySize) return false;
        // While loading first result, hide nothing yet by availability (capacity already applied).
        // Once we have a result set, keep only available spaces.
        if (availableSpaceIds && !availableSpaceIds.has(space.id)) return false;
      }
      if (!q) return true;
      const haystack = `${space.name} ${building?.name ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [
    availableSpaceIds,
    buildingFilter,
    catalog,
    minCapacity,
    periodPartySize,
    periodReady,
    search,
  ]);

  const filteredIds = useMemo(() => new Set(filtered.map((entry) => entry.space.id)), [filtered]);

  const slotBySpaceId = useMemo(() => {
    const map = new Map<string, WizardSpaceSlot>();
    for (const slot of slots) {
      if (slot.spaceId && !map.has(slot.spaceId)) {
        map.set(slot.spaceId, slot);
      }
    }
    return map;
  }, [slots]);

  const hasHiddenSelected = slots.some((slot) => slot.spaceId && !filteredIds.has(slot.spaceId));
  const showSelectedChips = slots.length > 1 || hasHiddenSelected;

  useEffect(() => {
    if (focusedSpaceId && slotBySpaceId.has(focusedSpaceId)) return;
    const last = slots[slots.length - 1];
    setFocusedSpaceId(last?.spaceId ?? null);
  }, [slots, focusedSpaceId, slotBySpaceId]);

  const focusedEntry = useMemo(() => {
    if (!focusedSpaceId) return null;
    return catalog.find((entry) => entry.space.id === focusedSpaceId) ?? null;
  }, [catalog, focusedSpaceId]);

  const focusedSlot = focusedSpaceId ? slotBySpaceId.get(focusedSpaceId) : undefined;

  function selectSpace(space: SpaceResponse) {
    setFocusedSpaceId(space.id);
    if (slotBySpaceId.has(space.id)) return;

    const usePeriod = periodReady;
    const startLocal = usePeriod ? periodStartLocal : "";
    const endLocal = usePeriod ? periodEndLocal : "";
    const partySize = usePeriod
      ? Math.min(Math.max(periodPartySize, 1), space.capacity)
      : Math.min(1, space.capacity) || 1;
    const knownAvailable = usePeriod && availableSpaceIds?.has(space.id) === true;

    onChange([
      ...slots,
      {
        key: newSlotKey(),
        buildingId: space.buildingId,
        spaceId: space.id,
        spaceName: space.name,
        startLocal,
        endLocal,
        partySize,
        ...(knownAvailable ? { available: true, availabilityReason: "ok" } : {}),
      },
    ]);
  }

  function deselectSpace(spaceId: string) {
    const next = slots.filter((slot) => slot.spaceId !== spaceId);
    onChange(next);
    if (focusedSpaceId === spaceId) {
      setFocusedSpaceId(next[next.length - 1]?.spaceId ?? null);
    }
  }

  function patchSpace(
    spaceId: string,
    patch: Partial<Pick<WizardSpaceSlot, "startLocal" | "endLocal" | "partySize">>,
  ) {
    onChange(
      slots.map((slot) =>
        slot.spaceId === spaceId
          ? { ...slot, ...patch, available: undefined, availabilityReason: undefined }
          : slot,
      ),
    );
  }

  function clearPeriod() {
    filterGenerationRef.current += 1;
    setPeriodStartLocal("");
    setPeriodEndLocal("");
    setPeriodPartySize(1);
    setAvailableSpaceIds(null);
    setFilteringAvailability(false);
  }

  const incompleteCount = slots.filter((slot) => !isWizardSpaceSlotComplete(slot)).length;

  return (
    <section className={styles.panel} aria-labelledby="quote-spaces-title">
      <h2 id="quote-spaces-title" className={styles.panelTitle}>
        Espaces
      </h2>
      <p className={pageStyles.muted}>
        Indiquez la période et le nombre de personnes pour filtrer les espaces disponibles, puis
        sélectionnez. Vous pouvez encore ajuster chaque espace dans le panneau.
      </p>

      <div className={styles.periodBlock} data-period-block="true">
        <div className={styles.periodBlockHeader}>
          <h3 className={styles.periodBlockTitle}>Période &amp; personnes</h3>
          {periodStartLocal || periodEndLocal ? (
            <button type="button" className={styles.periodClearButton} onClick={clearPeriod}>
              Effacer
            </button>
          ) : null}
        </div>
        <p className={styles.periodBlockHint}>
          Une fois la période renseignée, la grille n’affiche que les espaces libres et assez
          grands. Sans période, tous les espaces restent visibles (à compléter au panneau).
        </p>
        <div className={styles.periodBlockFields}>
          <QuoteDurationRangeField
            label="Période"
            startLocal={periodStartLocal}
            endLocal={periodEndLocal}
            onChange={(next) => {
              setPeriodStartLocal(next.startLocal);
              setPeriodEndLocal(next.endLocal);
            }}
          />
          <label className={pageStyles.label}>
            Nombre de personnes
            <input
              className={pageStyles.input}
              type="number"
              min={1}
              max={500}
              value={periodPartySize}
              onChange={(event) => setPeriodPartySize(Math.max(1, Number(event.target.value) || 1))}
            />
          </label>
        </div>
      </div>

      <div
        className={[
          styles.catalogFilters,
          showBuildingFilter ? styles.catalogFiltersWithBuilding : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <label className={`${pageStyles.label} ${styles.filterSearch}`}>
          Rechercher
          <span className={styles.filterSearchField}>
            <IconSearch size={16} stroke={1.75} aria-hidden="true" />
            <input
              className={pageStyles.input}
              type="search"
              placeholder="Nom ou bâtiment…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </span>
        </label>
        {showBuildingFilter ? (
          <label className={pageStyles.label}>
            Bâtiment
            <select
              className={pageStyles.input}
              value={buildingFilter}
              onChange={(event) => setBuildingFilter(event.target.value)}
            >
              <option value="">Tous</option>
              {buildingsInCatalog.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className={pageStyles.label}>
          Capacité min.
          <input
            className={pageStyles.input}
            type="number"
            min={0}
            placeholder="0"
            value={minCapacity || ""}
            onChange={(event) => setMinCapacity(Math.max(0, Number(event.target.value) || 0))}
          />
        </label>
      </div>

      {incompleteCount > 0 ? (
        <p className={styles.serviceIncompleteHint}>
          {incompleteCount} espace{incompleteCount > 1 ? "s" : ""} à compléter (durée, personnes ou
          disponibilité).
        </p>
      ) : null}

      {showSelectedChips ? (
        <div className={styles.selectedChips} aria-label="Espaces sélectionnés">
          {slots.map((slot) => (
            <button
              key={slot.key}
              type="button"
              className={[
                styles.selectedChip,
                slot.spaceId === focusedSpaceId ? styles.selectedChipActive : "",
                slot.spaceId && !filteredIds.has(slot.spaceId) ? styles.selectedChipHidden : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setFocusedSpaceId(slot.spaceId)}
            >
              {slot.spaceName || "Espace"}
              {slot.spaceId && !filteredIds.has(slot.spaceId) ? " · hors filtre" : ""}
            </button>
          ))}
        </div>
      ) : null}

      <div className={styles.splitLayout}>
        <div className={styles.splitMain}>
          {filteringAvailability ? (
            <p className={pageStyles.muted} role="status" aria-live="polite">
              Vérification des disponibilités…
            </p>
          ) : null}
          {filtered.length === 0 && !filteringAvailability ? (
            <p className={pageStyles.muted}>
              {periodReady
                ? "Aucun espace disponible pour cette période et ce nombre de personnes."
                : "Aucun espace ne correspond aux filtres."}
            </p>
          ) : (
            <div
              className={[
                styles.catalogGridCompact,
                filteringAvailability ? styles.catalogGridFiltering : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-busy={filteringAvailability}
            >
              {filtered.map(({ space, building }) => {
                const slot = slotBySpaceId.get(space.id);
                return (
                  <QuoteSpaceCard
                    key={space.id}
                    space={space}
                    building={building}
                    selected={Boolean(slot)}
                    focused={focusedSpaceId === space.id}
                    complete={slot ? isWizardSpaceSlotComplete(slot) : true}
                    onSelect={() => selectSpace(space)}
                    onDeselect={() => deselectSpace(space.id)}
                    onFocus={() => setFocusedSpaceId(space.id)}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.splitSide}>
          {focusedEntry && focusedSlot ? (
            <SpaceDetailPanel
              space={focusedEntry.space}
              building={focusedEntry.building}
              startLocal={focusedSlot.startLocal}
              endLocal={focusedSlot.endLocal}
              partySize={focusedSlot.partySize}
              available={focusedSlot.available}
              availabilityReason={focusedSlot.availabilityReason}
              checkingAvailability={checkingAvailability}
              onPatch={(patch) => patchSpace(focusedEntry.space.id, patch)}
              onDeselect={() => deselectSpace(focusedEntry.space.id)}
            />
          ) : (
            <div className={styles.detailEmpty}>
              <p className={pageStyles.muted}>
                Sélectionnez un espace pour configurer la durée et le nombre de personnes.
              </p>
            </div>
          )}
        </div>
      </div>

      {locksExpiresAt ? (
        <p className={pageStyles.muted}>
          Locks actifs jusqu’à{" "}
          {new Date(locksExpiresAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
        </p>
      ) : null}
    </section>
  );
}
