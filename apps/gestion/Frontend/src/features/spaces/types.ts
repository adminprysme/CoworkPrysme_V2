export type BuildingStatus = "active" | "inactive";

export type WeekDay =
  "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface DaySchedule {
  day: WeekDay;
  is24h: boolean;
  openTime: string;
  closeTime: string;
}

export interface BuildingFloor {
  id: string;
  name: string;
}

export interface BuildingPhoto {
  id: string;
  previewUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey?: string;
  /** Local file pending upload — never sent to API directly. */
  file?: File;
}

export interface BuildingAddress {
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

export interface BuildingConcierge {
  link: string;
  accessCode: string;
}

export interface Building {
  id: string;
  name: string;
  description?: string;
  phone?: string;
  email?: string;
  address: BuildingAddress;
  lat: number;
  lng: number;
  floors: BuildingFloor[];
  status: BuildingStatus;
  accessibilityHours: DaySchedule[];
  receptionHours: DaySchedule[];
  concierge: BuildingConcierge;
  photos: BuildingPhoto[];
  /** Active (non-archived) space count — populated on list page. */
  spaceCount?: number;
}

export interface BuildingFormValues {
  name: string;
  description: string;
  phone: string;
  email: string;
  address: BuildingAddress;
  lat: number | null;
  lng: number | null;
  floors: BuildingFloor[];
  status: BuildingStatus;
  accessibilityHours: DaySchedule[];
  receptionHours: DaySchedule[];
  concierge: BuildingConcierge;
  photos: BuildingPhoto[];
}

export const WEEK_DAYS: WeekDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const WEEK_DAY_LABELS: Record<WeekDay, string> = {
  monday: "Lundi",
  tuesday: "Mardi",
  wednesday: "Mercredi",
  thursday: "Jeudi",
  friday: "Vendredi",
  saturday: "Samedi",
  sunday: "Dimanche",
};

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

/** @deprecated Use Building */
export type MockBuilding = Building;
