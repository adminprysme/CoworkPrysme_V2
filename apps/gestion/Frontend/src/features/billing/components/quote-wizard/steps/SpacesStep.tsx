import { useEffect, useMemo, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import type { BuildingResponse, SpaceResponse } from "@coworkprysme/shared";

import pageStyles from "../../../BillingPages.module.css";
import type { WizardSpaceSlot } from "../../../lib/quote-wizard-state.js";
import { isWizardSpaceSlotComplete, newSlotKey } from "../../../lib/quote-wizard-state.js";
import { QuoteSpaceCard } from "../QuoteSpaceCard.js";
import { SpaceDetailPanel } from "../SpaceDetailPanel.js";
import styles from "../QuoteWizard.module.css";

type SpacesStepProps = {
  slots: WizardSpaceSlot[];
  buildings: BuildingResponse[];
  spacesByBuilding: Map<string, SpaceResponse[]>;
  locksExpiresAt: string | null;
  checkingAvailability?: boolean;
  onChange: (slots: WizardSpaceSlot[]) => void;
};

type CatalogEntry = {
  space: SpaceResponse;
  building: BuildingResponse | undefined;
};

export function SpacesStep({
  slots,
  buildings,
  spacesByBuilding,
  locksExpiresAt,
  checkingAvailability = false,
  onChange,
}: SpacesStepProps) {
  const [search, setSearch] = useState("");
  const [minCapacity, setMinCapacity] = useState(0);
  const [buildingFilter, setBuildingFilter] = useState("");
  const [focusedSpaceId, setFocusedSpaceId] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter(({ space, building }) => {
      if (buildingFilter && building?.id !== buildingFilter) return false;
      if (minCapacity > 0 && space.capacity < minCapacity) return false;
      if (!q) return true;
      const haystack = `${space.name} ${building?.name ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [catalog, search, minCapacity, buildingFilter]);

  const slotBySpaceId = useMemo(() => {
    const map = new Map<string, WizardSpaceSlot>();
    for (const slot of slots) {
      if (slot.spaceId && !map.has(slot.spaceId)) {
        map.set(slot.spaceId, slot);
      }
    }
    return map;
  }, [slots]);

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
    onChange([
      ...slots,
      {
        key: newSlotKey(),
        buildingId: space.buildingId,
        spaceId: space.id,
        spaceName: space.name,
        startLocal: "",
        endLocal: "",
        partySize: Math.min(1, space.capacity) || 1,
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

  const incompleteCount = slots.filter((slot) => !isWizardSpaceSlotComplete(slot)).length;

  return (
    <section className={styles.panel} aria-labelledby="quote-spaces-title">
      <h2 id="quote-spaces-title" className={styles.panelTitle}>
        Espaces
      </h2>
      <p className={pageStyles.muted}>
        Sélectionnez un ou plusieurs espaces. La configuration (durée, personnes) s’édite dans le
        panneau — la disponibilité se vérifie automatiquement.
      </p>

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

      {slots.length > 1 ? (
        <div className={styles.selectedChips} aria-label="Espaces sélectionnés">
          {slots.map((slot) => (
            <button
              key={slot.key}
              type="button"
              className={[
                styles.selectedChip,
                slot.spaceId === focusedSpaceId ? styles.selectedChipActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setFocusedSpaceId(slot.spaceId)}
            >
              {slot.spaceName || "Espace"}
            </button>
          ))}
        </div>
      ) : null}

      <div className={styles.splitLayout}>
        <div className={styles.splitMain}>
          {filtered.length === 0 ? (
            <p className={pageStyles.muted}>Aucun espace ne correspond aux filtres.</p>
          ) : (
            <div className={styles.catalogGridCompact}>
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
