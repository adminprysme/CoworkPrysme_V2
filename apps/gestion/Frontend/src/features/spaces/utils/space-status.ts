import type { SpaceStatus } from "../space-types.js";

export const SPACE_STATUS_LABELS: Record<SpaceStatus, string> = {
  active: "Actif",
  inactive: "Inactif",
  archived: "Archivé",
};

export function isArchivedSpace(status: SpaceStatus): boolean {
  return status === "archived";
}
