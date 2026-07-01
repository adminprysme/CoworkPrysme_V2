import type { Space, SpaceFormValues } from "../space-types.js";
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

export function createEmptySpaceFormValues(floorNames: string[]): SpaceFormValues {
  return {
    type: "meeting_room",
    name: "",
    description: "",
    floor: floorNames[0] ?? "",
    capacity: defaultCapacity("meeting_room"),
    equipments: [],
    openingHours: createDefaultDaySchedules(),
    status: "active",
    photos: [],
  };
}

export function formValuesToSpace(values: SpaceFormValues, buildingId: string, id?: string): Space {
  return {
    id: id ?? crypto.randomUUID(),
    buildingId,
    type: values.type,
    name: values.name.trim(),
    description: values.description.trim(),
    floor: values.floor,
    capacity: values.capacity,
    equipments: values.equipments,
    openingHours: values.openingHours,
    status: values.status,
    photos: values.photos,
  };
}

export function spaceToFormValues(space: Space): SpaceFormValues {
  return {
    type: space.type,
    name: space.name,
    description: space.description,
    floor: space.floor,
    capacity: space.capacity,
    equipments: space.equipments.map((entry) => ({ ...entry })),
    openingHours: space.openingHours.map((entry) => ({ ...entry })),
    status: space.status,
    photos: space.photos.map((photo) => ({ ...photo })),
  };
}
