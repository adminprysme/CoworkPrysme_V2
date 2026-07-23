import type { BuildingResponse, SpaceResponse } from "@coworkprysme/shared";

import pageStyles from "../../../BillingPages.module.css";
import type { WizardSpaceSlot } from "../../../lib/quote-wizard-state.js";
import { newSlotKey } from "../../../lib/quote-wizard-state.js";
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
  function updateSlot(key: string, patch: Partial<WizardSpaceSlot>) {
    onChange(slots.map((slot) => (slot.key === key ? { ...slot, ...patch } : slot)));
  }

  function addSlot() {
    const firstBuilding = buildings[0];
    const spaces = firstBuilding ? (spacesByBuilding.get(firstBuilding.id) ?? []) : [];
    const firstSpace = spaces[0];
    onChange([
      ...slots,
      {
        key: newSlotKey(),
        buildingId: firstBuilding?.id ?? "",
        spaceId: firstSpace?.id ?? "",
        spaceName: firstSpace?.name ?? "",
        startLocal: "",
        endLocal: "",
        partySize: 1,
      },
    ]);
  }

  return (
    <section className={styles.panel} aria-labelledby="quote-spaces-title">
      <h2 id="quote-spaces-title" className={styles.panelTitle}>
        Espaces
      </h2>
      <p className={pageStyles.muted}>
        Ajoutez un ou plusieurs créneaux. Vérifiez la disponibilité puis verrouillez les slots pour
        le wizard.
      </p>

      {slots.map((slot, index) => {
        const spaces = spacesByBuilding.get(slot.buildingId) ?? [];
        return (
          <div key={slot.key} className={styles.slotCard}>
            <div className={styles.slotHeader}>
              <strong>Créneau {index + 1}</strong>
              <button
                type="button"
                className={pageStyles.dangerButton}
                onClick={() => onChange(slots.filter((item) => item.key !== slot.key))}
              >
                Retirer
              </button>
            </div>
            <div className={pageStyles.fieldGrid}>
              <label className={pageStyles.label}>
                Bâtiment
                <select
                  className={pageStyles.select}
                  value={slot.buildingId}
                  onChange={(event) => {
                    const buildingId = event.target.value;
                    const nextSpaces = spacesByBuilding.get(buildingId) ?? [];
                    const space = nextSpaces[0];
                    updateSlot(slot.key, {
                      buildingId,
                      spaceId: space?.id ?? "",
                      spaceName: space?.name ?? "",
                      available: undefined,
                    });
                  }}
                >
                  <option value="">Choisir…</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={pageStyles.label}>
                Espace
                <select
                  className={pageStyles.select}
                  value={slot.spaceId}
                  onChange={(event) => {
                    const spaceId = event.target.value;
                    const space = spaces.find((item) => item.id === spaceId);
                    updateSlot(slot.key, {
                      spaceId,
                      spaceName: space?.name ?? "",
                      available: undefined,
                    });
                  }}
                >
                  <option value="">Choisir…</option>
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name} (cap. {space.capacity})
                    </option>
                  ))}
                </select>
              </label>
              <label className={pageStyles.label}>
                Début
                <input
                  className={pageStyles.input}
                  type="datetime-local"
                  value={slot.startLocal}
                  onChange={(event) =>
                    updateSlot(slot.key, { startLocal: event.target.value, available: undefined })
                  }
                />
              </label>
              <label className={pageStyles.label}>
                Fin
                <input
                  className={pageStyles.input}
                  type="datetime-local"
                  value={slot.endLocal}
                  onChange={(event) =>
                    updateSlot(slot.key, { endLocal: event.target.value, available: undefined })
                  }
                />
              </label>
              <label className={pageStyles.label}>
                Personnes
                <input
                  className={pageStyles.input}
                  type="number"
                  min={1}
                  value={slot.partySize}
                  onChange={(event) =>
                    updateSlot(slot.key, {
                      partySize: Math.max(1, Number(event.target.value) || 1),
                      available: undefined,
                    })
                  }
                />
              </label>
            </div>
            {slot.available === true ? <p className={styles.ok}>Disponible</p> : null}
            {slot.available === false ? (
              <p className={styles.ko}>
                Indisponible{slot.availabilityReason ? ` — ${slot.availabilityReason}` : ""}
              </p>
            ) : null}
          </div>
        );
      })}

      <div className={pageStyles.toolbar}>
        <button type="button" className={pageStyles.secondaryButton} onClick={addSlot}>
          Ajouter un créneau
        </button>
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
