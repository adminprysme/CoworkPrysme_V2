import { BadRequestException } from "@nestjs/common";

export interface VitrineBuildingFlagsInput {
  status: "active" | "inactive";
  visibleOnVitrine: boolean;
  isDefaultVitrineBuilding: boolean;
}

export interface VitrineBuildingFlags {
  visibleOnVitrine: boolean;
  isDefaultVitrineBuilding: boolean;
}

export function resolveVitrineBuildingFlags(
  input: VitrineBuildingFlagsInput,
): VitrineBuildingFlags {
  if (input.status === "inactive") {
    if (input.visibleOnVitrine || input.isDefaultVitrineBuilding) {
      throw new BadRequestException(
        "Un bâtiment inactif ne peut pas être visible sur la vitrine ni bâtiment par défaut.",
      );
    }
    return { visibleOnVitrine: false, isDefaultVitrineBuilding: false };
  }

  if (!input.visibleOnVitrine) {
    return { visibleOnVitrine: false, isDefaultVitrineBuilding: false };
  }

  return {
    visibleOnVitrine: true,
    isDefaultVitrineBuilding: input.isDefaultVitrineBuilding,
  };
}
