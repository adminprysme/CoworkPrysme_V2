import type { SpaceFormValues } from "../space-types.js";
import type { DaySchedule } from "../types.js";
import { createDefaultDaySchedules } from "./schedule.js";

export type SpaceFormErrors = Partial<
  Record<"name" | "floor" | "capacity" | "equipments" | "photos", string>
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
  };
}
