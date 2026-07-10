import { useEffect, useMemo, useState } from "react";

import { VITRINE_FEATURED_SPACES_MAX } from "@coworkprysme/shared";
import type { SpaceResponse } from "@coworkprysme/shared";

import { fetchBuildings } from "../../lib/buildings-api.js";
import { fetchSpacesByBuilding } from "../../lib/spaces-api.js";
import styles from "./VitrineFeaturedSpacesField.module.css";

interface SelectableSpace {
  id: string;
  label: string;
  typeLabel: string;
  capacity: number;
}

interface VitrineFeaturedSpacesFieldProps {
  selectedIds: string[];
  saving: boolean;
  onSave: (spaceIds: string[]) => Promise<void>;
}

function spaceTypeLabel(type: SpaceResponse["type"]): string {
  return type === "private_office" ? "Bureau privatif" : "Salle de réunion";
}

function buildSlots(selectedIds: string[]): string[] {
  const slots = [...selectedIds];
  while (slots.length < VITRINE_FEATURED_SPACES_MAX) {
    slots.push("");
  }
  return slots.slice(0, VITRINE_FEATURED_SPACES_MAX);
}

export function VitrineFeaturedSpacesField({
  selectedIds,
  saving,
  onSave,
}: VitrineFeaturedSpacesFieldProps) {
  const [spaces, setSpaces] = useState<SelectableSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>(() => buildSlots(selectedIds));

  useEffect(() => {
    setSlots(buildSlots(selectedIds));
  }, [selectedIds]);

  useEffect(() => {
    let cancelled = false;

    async function loadSpaces() {
      setLoading(true);
      setLoadError(null);
      try {
        const { buildings } = await fetchBuildings();
        const results = await Promise.all(
          buildings.map(async (building) => {
            const { spaces: buildingSpaces } = await fetchSpacesByBuilding(building.id);
            return buildingSpaces
              .filter((space) => space.status !== "archived")
              .map((space) => ({
                id: space.id,
                label: `${space.name} — ${building.name}`,
                typeLabel: spaceTypeLabel(space.type),
                capacity: space.capacity,
              }));
          }),
        );

        if (!cancelled) {
          setSpaces(results.flat());
        }
      } catch {
        if (!cancelled) {
          setLoadError("Impossible de charger la liste des espaces.");
          setSpaces([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSpaces();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSet = useMemo(() => new Set(slots.filter(Boolean)), [slots]);
  const dirty = slots.filter(Boolean).join(",") !== selectedIds.join(",");

  function updateSlot(index: number, value: string) {
    setSlots((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  async function handleSave() {
    const nextIds = slots.filter(Boolean);
    await onSave(nextIds);
  }

  return (
    <div className={styles.section}>
      <p className={styles.description}>
        Choisissez jusqu&apos;à {VITRINE_FEATURED_SPACES_MAX} espaces affichés sur la page publique
        /services. Les informations (nom, capacité, équipements, photo) proviennent directement de
        la fiche espace.
      </p>

      {loading ? <p className={styles.hint}>Chargement des espaces…</p> : null}
      {loadError ? <p className={styles.error}>{loadError}</p> : null}

      {!loading && !loadError ? (
        <div className={styles.slots}>
          {slots.map((value, index) => (
            <div key={`slot-${index}`} className={styles.slot}>
              <label className={styles.label} htmlFor={`featured-space-${index}`}>
                Fiche {index + 1}
              </label>
              <select
                id={`featured-space-${index}`}
                className={styles.select}
                value={value}
                disabled={saving}
                onChange={(event) => updateSlot(index, event.target.value)}
              >
                <option value="">— Aucun —</option>
                {spaces.map((space) => (
                  <option
                    key={space.id}
                    value={space.id}
                    disabled={selectedSet.has(space.id) && space.id !== value}
                  >
                    {space.label} ({space.typeLabel}, {space.capacity} pers.)
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={saving || loading || !dirty}
          onClick={() => void handleSave()}
        >
          {saving ? "Enregistrement…" : "Enregistrer les fiches produits"}
        </button>
      </div>
    </div>
  );
}
