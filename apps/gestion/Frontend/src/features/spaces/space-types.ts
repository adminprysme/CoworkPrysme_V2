import type { BuildingPhoto, DaySchedule } from "./types.js";
import type { SpaceTariffFormLine } from "./utils/space-tariffs.js";

export type SpaceType = "meeting_room" | "private_office";
export type SpaceStatus = "active" | "inactive" | "archived";
export type SpaceOperationalStatus = "active" | "inactive";

export interface SpaceEquipment {
  key: string;
  label: string;
}

export interface SpaceTariff {
  durationClass: SpaceTariffFormLine["durationClass"];
  label: string;
  priceHT: number;
  vatRate: number;
}

export interface Space {
  id: string;
  buildingId: string;
  type: SpaceType;
  name: string;
  description: string;
  floor: string;
  capacity: number;
  equipments: SpaceEquipment[];
  openingHours: DaySchedule[];
  accessCode?: string;
  status: SpaceStatus;
  archivedAt?: string;
  archivedBy?: string;
  photos: BuildingPhoto[];
  tariffs: SpaceTariff[];
}

export interface SpaceFormValues {
  type: SpaceType;
  name: string;
  description: string;
  floor: string;
  capacity: number;
  equipments: SpaceEquipment[];
  openingHours: DaySchedule[];
  useBuildingHours: boolean;
  accessCode: string;
  status: SpaceOperationalStatus;
  photos: BuildingPhoto[];
  tariffs: SpaceTariffFormLine[];
}

export const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  meeting_room: "Salle de réunion",
  private_office: "Bureau privatif",
};

export const PREDEFINED_EQUIPMENTS: SpaceEquipment[] = [
  { key: "projector", label: "Vidéoprojecteur" },
  { key: "whiteboard", label: "Paperboard" },
  { key: "screen", label: "Écran" },
  { key: "videoconf", label: "Visioconférence" },
  { key: "wifi", label: "Wifi" },
  { key: "ac", label: "Climatisation" },
  { key: "coffee", label: "Machine à café" },
];

export type SpaceTypeFilter = "all" | SpaceType;
export type SpaceStatusFilter = "all" | SpaceStatus;
