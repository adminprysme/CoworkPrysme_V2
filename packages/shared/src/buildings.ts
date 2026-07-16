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

export const BUILDING_ACCESS_INFO_MAX_LENGTH = 2000;

/** API / form address — uses postalCode (not zip). */
export const BuildingAddressInputSchema = z.object({
  street: z.string().trim().min(1),
  postalCode: z.string().trim().min(1),
  city: z.string().trim().min(1),
  country: z.string().trim().min(1),
  accessInfo: z.string().trim().max(BUILDING_ACCESS_INFO_MAX_LENGTH).optional(),
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

export const BUILDING_DESCRIPTION_MAX_LENGTH = 2000;
export const BUILDING_PHONE_MAX_LENGTH = 32;
export const BUILDING_EMAIL_MAX_LENGTH = 254;

export const BuildingDescriptionSchema = z
  .string()
  .trim()
  .max(BUILDING_DESCRIPTION_MAX_LENGTH)
  .optional();

export const BuildingPhoneSchema = z.string().trim().max(BUILDING_PHONE_MAX_LENGTH).optional();

export const BuildingEmailSchema = z
  .string()
  .trim()
  .max(BUILDING_EMAIL_MAX_LENGTH)
  .optional()
  .refine((value) => !value || z.string().email().safeParse(value).success, {
    message: "Invalid email address",
  });

export const CreateBuildingRequestSchema = z.object({
  name: z.string().trim().min(1),
  description: BuildingDescriptionSchema,
  phone: BuildingPhoneSchema,
  email: BuildingEmailSchema,
  address: BuildingAddressInputSchema,
  floors: z.array(BuildingFloorInputSchema).min(1),
  status: BuildingStatusSchema,
  accessibilityHours: z.array(BuildingDayScheduleInputSchema).length(7),
  receptionHours: z.array(BuildingDayScheduleInputSchema).length(7),
  concierge: BuildingConciergeInputSchema,
  visibleOnVitrine: z.boolean().default(false),
  isDefaultVitrineBuilding: z.boolean().default(false),
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

export const BuildingSeoResponseSchema = z.object({
  slug: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
});

export const BuildingResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: BuildingDescriptionSchema,
  phone: z.string().optional(),
  email: z.string().optional(),
  address: BuildingAddressResponseSchema,
  coordinates: BuildingCoordinatesResponseSchema,
  floors: z.array(BuildingFloorResponseSchema),
  status: BuildingStatusSchema,
  accessibilityHours: z.array(BuildingDayScheduleResponseSchema),
  receptionHours: z.array(BuildingDayScheduleResponseSchema),
  concierge: BuildingConciergeResponseSchema,
  photos: z.array(BuildingPhotoResponseSchema),
  visibleOnVitrine: z.boolean(),
  isDefaultVitrineBuilding: z.boolean(),
  seo: BuildingSeoResponseSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const BuildingsListResponseSchema = z.object({
  buildings: z.array(BuildingResponseSchema),
});

export const SiteContactSchema = z.object({
  email: z.string().nullable(),
  phone: z.string().nullable(),
  phoneHref: z.string().nullable(),
});

export type CreateBuildingRequest = z.infer<typeof CreateBuildingRequestSchema>;
export type UpdateBuildingRequest = z.infer<typeof UpdateBuildingRequestSchema>;
export type BuildingAddressInput = z.infer<typeof BuildingAddressInputSchema>;
export type BuildingResponse = z.infer<typeof BuildingResponseSchema>;
export type BuildingPhotoResponse = z.infer<typeof BuildingPhotoResponseSchema>;
export type BuildingsListResponse = z.infer<typeof BuildingsListResponseSchema>;
export type SiteContact = z.infer<typeof SiteContactSchema>;

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

export function normalizeOptionalBuildingContactField(
  value: string | undefined,
): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function buildPhoneHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) {
    return null;
  }
  if (digits.length === 10 && digits.startsWith("0")) {
    return `tel:+33${digits.slice(1)}`;
  }
  return digits.startsWith("33") ? `tel:+${digits}` : `tel:+${digits}`;
}
