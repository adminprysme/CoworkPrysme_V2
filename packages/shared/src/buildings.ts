import { z } from "zod";

export const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export const BuildingStatusSchema = z.enum(["active", "inactive"]);

export const TIME_OF_DAY_SCHEMA = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
  message: "Invalid HH:mm time",
});

/** API / form address — uses postalCode (not zip). */
export const BuildingAddressInputSchema = z.object({
  street: z.string().trim().min(1),
  postalCode: z.string().trim().min(1),
  city: z.string().trim().min(1),
  country: z.string().trim().min(1),
});

export const BuildingFloorInputSchema = z.object({
  name: z.string().trim().min(1),
});

export const BuildingDayScheduleInputSchema = z.object({
  day: z.enum(WEEK_DAYS),
  is24h: z.boolean(),
  openTime: TIME_OF_DAY_SCHEMA,
  closeTime: TIME_OF_DAY_SCHEMA,
});

export const BuildingConciergeInputSchema = z.object({
  link: z.string().trim(),
  accessCode: z.string().trim(),
});

export const CreateBuildingRequestSchema = z.object({
  name: z.string().trim().min(1),
  address: BuildingAddressInputSchema,
  floors: z.array(BuildingFloorInputSchema).min(1),
  status: BuildingStatusSchema,
  accessibilityHours: z.array(BuildingDayScheduleInputSchema).length(7),
  receptionHours: z.array(BuildingDayScheduleInputSchema).length(7),
  concierge: BuildingConciergeInputSchema,
});

export const UpdateBuildingRequestSchema = CreateBuildingRequestSchema;

export const BuildingAddressResponseSchema = BuildingAddressInputSchema;

export const BuildingCoordinatesResponseSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const BuildingFloorResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const BuildingDayScheduleResponseSchema = BuildingDayScheduleInputSchema;

export const BuildingConciergeResponseSchema = BuildingConciergeInputSchema;

export const BuildingPhotoResponseSchema = z.object({
  storageKey: z.string(),
  alt: z.string().optional(),
  order: z.number(),
  isPrimary: z.boolean(),
});

export const BuildingResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: BuildingAddressResponseSchema,
  coordinates: BuildingCoordinatesResponseSchema,
  floors: z.array(BuildingFloorResponseSchema),
  status: BuildingStatusSchema,
  accessibilityHours: z.array(BuildingDayScheduleResponseSchema),
  receptionHours: z.array(BuildingDayScheduleResponseSchema),
  concierge: BuildingConciergeResponseSchema,
  photos: z.array(BuildingPhotoResponseSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const BuildingsListResponseSchema = z.object({
  buildings: z.array(BuildingResponseSchema),
});

export type BuildingAddressInput = z.infer<typeof BuildingAddressInputSchema>;
export type CreateBuildingRequest = z.infer<typeof CreateBuildingRequestSchema>;
export type UpdateBuildingRequest = z.infer<typeof UpdateBuildingRequestSchema>;
export type BuildingResponse = z.infer<typeof BuildingResponseSchema>;
export type BuildingPhotoResponse = z.infer<typeof BuildingPhotoResponseSchema>;
export type BuildingsListResponse = z.infer<typeof BuildingsListResponseSchema>;

/** Maps form/API country labels to ISO-style codes stored in MongoDB. */
export function normalizeCountryToDb(country: string): string {
  const normalized = country.trim();
  if (/^france$/i.test(normalized) || /^fr$/i.test(normalized)) {
    return "FR";
  }
  return normalized;
}

/** Maps MongoDB country codes back to form-friendly labels. */
export function normalizeCountryFromDb(country: string): string {
  if (country === "FR") {
    return "France";
  }
  return country;
}
