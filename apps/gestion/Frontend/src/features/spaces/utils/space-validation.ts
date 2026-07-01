import type { SpaceFormValues } from "../space-types.js";
import type { DaySchedule } from "../types.js";
import { createDefaultDaySchedules } from "./schedule.js";
import { createDefaultTariffLines } from "./space-tariffs.js";

export type SpaceFormErrors = Partial<
  Record<"name" | "floor" | "capacity" | "equipments" | "photos" | "tariffs", string>
>;

export function validateSpaceForm(values: SpaceFormValues): SpaceFormErrors {
  const errors: SpaceFormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Le nom de l'espace est requis.";
  }

  if (!values.floor.trim()) {
    errors.floor = "Sélectionnez un étage.";
  }

  if (!Number.isFinite(values.capacity) || values.capacity < 1) {
    errors.capacity = "La capacité doit être d'au moins 1 personne.";
  }

  const enabledTariffs = values.tariffs.filter((tariff) => tariff.enabled);
  for (const tariff of enabledTariffs) {
    if (!Number.isFinite(tariff.priceEuros) || tariff.priceEuros < 0) {
      errors.tariffs = "Chaque tarif activé doit avoir un prix HT valide.";
      break;
    }
    if (!Number.isFinite(tariff.vatRate) || tariff.vatRate < 0) {
      errors.tariffs = "Chaque tarif activé doit avoir un taux de TVA valide.";
      break;
    }
  }

  return errors;
}

function defaultCapacity(type: SpaceFormValues["type"]): number {
  return type === "private_office" ? 2 : 8;
}

export function createEmptySpaceFormValues(
  floorNames: string[],
  buildingHours: DaySchedule[] = createDefaultDaySchedules(),
): SpaceFormValues {
  return {
    type: "meeting_room",
    name: "",
    description: "",
    floor: floorNames[0] ?? "",
    capacity: defaultCapacity("meeting_room"),
    equipments: [],
    openingHours: buildingHours.map((entry) => ({ ...entry })),
    useBuildingHours: true,
    accessCode: "",
    status: "active",
    photos: [],
    tariffs: createDefaultTariffLines(),
  };
}
