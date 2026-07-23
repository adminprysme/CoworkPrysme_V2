import { useMemo, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import type { BuildingResponse, SpaceResponse } from "@coworkprysme/shared";

import pageStyles from "../../../BillingPages.module.css";
import type { WizardSpaceSlot } from "../../../lib/quote-wizard-state.js";
import { newSlotKey } from "../../../lib/quote-wizard-state.js";
import { QuoteSpaceCard } from "../QuoteSpaceCard.js";
import styles from "../QuoteWizard.module.css";

type SpacesStepProps = {
  slots: WizardSpaceSlot[];
  buildings: BuildingResponse[];
  spacesByBuilding: Map<string, SpaceResponse[]>;
  locksExpiresAt: string | null;
  busy: boolean;
  onChange: (slots: WizardSpaceSlot[]) => void;
  onCheckAvailability: () => void;
  onAcquireLocks: () => void;
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
  busy,
  onChange,
  onCheckAvailability,
  onAcquireLocks,
}: SpacesStepProps) {
  const [search, setSearch] = useState("");
  const [minCapacity, setMinCapacity] = useState(0);

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
    entries.sort((a, b) => a.space.name.localeCompare(b.space.name, "fr"));
    return entries;
  }, [spacesByBuilding, buildingById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter(({ space, building }) => {
      if (minCapacity > 0 && space.capacity < minCapacity) return false;
      if (!q) return true;
      const haystack = `${space.name} ${building?.name ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [catalog, search, minCapacity]);

  const slotBySpaceId = useMemo(() => {
    const map = new Map<string, WizardSpaceSlot>();
    for (const slot of slots) {
      if (slot.spaceId && !map.has(slot.spaceId)) {
        map.set(slot.spaceId, slot);
      }
    }
    return map;
  }, [slots]);

  function selectSpace(space: SpaceResponse) {
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
    onChange(slots.filter((slot) => slot.spaceId !== spaceId));
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

  return (
    <section className={styles.panel} aria-labelledby="quote-spaces-title">
      <h2 id="quote-spaces-title" className={styles.panelTitle}>
        Espaces
      </h2>
      <p className={pageStyles.muted}>
        Sélectionnez un ou plusieurs espaces, renseignez les créneaux, puis vérifiez la
        disponibilité et verrouillez.
      </p>

      <div className={styles.catalogFilters}>
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

      {filtered.length === 0 ? (
        <p className={pageStyles.muted}>Aucun espace ne correspond aux filtres.</p>
      ) : (
        <div className={styles.catalogGrid}>
          {filtered.map(({ space, building }) => {
            const slot = slotBySpaceId.get(space.id);
            return (
              <QuoteSpaceCard
                key={space.id}
                space={space}
                building={building}
                selected={Boolean(slot)}
                startLocal={slot?.startLocal ?? ""}
                endLocal={slot?.endLocal ?? ""}
                partySize={slot?.partySize ?? 1}
                available={slot?.available}
                availabilityReason={slot?.availabilityReason}
                onSelect={() => selectSpace(space)}
                onDeselect={() => deselectSpace(space.id)}
                onPatch={(patch) => patchSpace(space.id, patch)}
              />
            );
          })}
        </div>
      )}

      <div className={pageStyles.toolbar}>
        <button
          type="button"
          className={pageStyles.secondaryButton}
          disabled={busy || slots.length === 0}
          onClick={onCheckAvailability}
        >
          Vérifier dispo
        </button>
        <button
          type="button"
          className={pageStyles.primaryButton}
          disabled={busy || slots.length === 0}
          onClick={onAcquireLocks}
        >
          Verrouiller
        </button>
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
