import { z } from "zod";

import {
  BuildingDayScheduleInputSchema,
  BuildingDayScheduleResponseSchema,
  BuildingPhotoResponseSchema,
} from "./buildings.js";
import { eurosToCents, isValidEuroAmount } from "./money.js";

export const SPACE_TYPES = ["meeting_room", "private_office"] as const;

export const SpaceTypeSchema = z.enum(SPACE_TYPES);

export const SPACE_STATUSES = ["active", "inactive", "archived"] as const;

export const SpaceStatusSchema = z.enum(SPACE_STATUSES);

export const SpaceOperationalStatusSchema = z.enum(["active", "inactive"]);

export const SPACE_DESCRIPTION_MAX_LENGTH = 2000;

export const SpaceDescriptionSchema = z
  .string()
  .trim()
  .max(SPACE_DESCRIPTION_MAX_LENGTH)
  .optional();

export const SpaceEquipmentInputSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
});

export const SpaceAccessCodeSchema = z.string().trim().optional();

export const SPACE_DURATION_CLASSES = ["hourly", "halfday", "daily", "weekly", "monthly"] as const;

export const SpaceDurationClassSchema = z.enum(SPACE_DURATION_CLASSES);

export const DEFAULT_SPACE_TARIFF_VAT_RATE = 20;
export const MAX_SPACE_TARIFFS = 5;

export const DURATION_CLASS_LABELS: Record<(typeof SPACE_DURATION_CLASSES)[number], string> = {
  hourly: "Heure",
  halfday: "Demi-journée",
  daily: "Journée",
  weekly: "Semaine",
  monthly: "Mois",
};

export const euroAmountSchema = z
  .number()
  .min(0)
  .refine((value) => isValidEuroAmount(value), {
    message: "Amount must have at most 2 decimal places",
  });

export const SpaceTariffInputSchema = z.object({
  durationClass: SpaceDurationClassSchema,
  priceEuros: euroAmountSchema,
  vatRate: z.number().min(0).default(DEFAULT_SPACE_TARIFF_VAT_RATE),
  enabled: z.boolean(),
});

export const SpaceTariffResponseSchema = z.object({
  durationClass: SpaceDurationClassSchema,
  priceHT: z.number().int().min(0),
  vatRate: z.number().min(0),
});

const tariffsInputSchema = z
  .array(SpaceTariffInputSchema)
  .max(MAX_SPACE_TARIFFS)
  .superRefine((tariffs, context) => {
    const enabledClasses = tariffs.filter((tariff) => tariff.enabled).map((t) => t.durationClass);
    if (new Set(enabledClasses).size !== enabledClasses.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each enabled durationClass must be unique",
        path: [],
      });
    }
  })
  .default([]);

export const CreateSpaceRequestSchema = z.object({
  type: SpaceTypeSchema,
  name: z.string().trim().min(1),
  description: SpaceDescriptionSchema,
  floor: z.string().trim().min(1),
  capacity: z.number().int().min(1),
  equipments: z.array(SpaceEquipmentInputSchema),
  openingHours: z.array(BuildingDayScheduleInputSchema).length(7),
  accessCode: SpaceAccessCodeSchema,
  status: SpaceOperationalStatusSchema,
  tariffs: tariffsInputSchema,
});

export const UpdateSpaceRequestSchema = CreateSpaceRequestSchema;

export const SpaceSeoResponseSchema = z.object({
  slug: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
});

export const SpaceResponseSchema = z.object({
  id: z.string(),
  buildingId: z.string(),
  type: SpaceTypeSchema,
  name: z.string(),
  description: SpaceDescriptionSchema,
  floor: z.string(),
  capacity: z.number(),
  equipments: z.array(SpaceEquipmentInputSchema),
  openingHours: z.array(BuildingDayScheduleResponseSchema),
  accessCode: SpaceAccessCodeSchema,
  status: SpaceStatusSchema,
  archivedAt: z.string().datetime().optional(),
  archivedBy: z.string().optional(),
  photos: z.array(BuildingPhotoResponseSchema),
  tariffs: z.array(SpaceTariffResponseSchema),
  seo: SpaceSeoResponseSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SpacesListResponseSchema = z.object({
  spaces: z.array(SpaceResponseSchema),
});

export const SpaceArchiveResponseSchema = z.object({
  ok: z.literal(true),
  space: SpaceResponseSchema,
});

export const SpaceRestoreRequestSchema = z.object({
  status: SpaceOperationalStatusSchema.default("inactive"),
});

export type SpaceStatus = z.infer<typeof SpaceStatusSchema>;
export type SpaceOperationalStatus = z.infer<typeof SpaceOperationalStatusSchema>;
export type SpaceDurationClass = z.infer<typeof SpaceDurationClassSchema>;
export type SpaceTariffInput = z.infer<typeof SpaceTariffInputSchema>;
export type SpaceTariffResponse = z.infer<typeof SpaceTariffResponseSchema>;
export type CreateSpaceRequest = z.infer<typeof CreateSpaceRequestSchema>;
export type UpdateSpaceRequest = z.infer<typeof UpdateSpaceRequestSchema>;
export type SpaceResponse = z.infer<typeof SpaceResponseSchema>;
export type SpacesListResponse = z.infer<typeof SpacesListResponseSchema>;
export type SpaceArchiveResponse = z.infer<typeof SpaceArchiveResponseSchema>;
export type SpaceRestoreRequest = z.infer<typeof SpaceRestoreRequestSchema>;
export type SpaceSeoResponse = z.infer<typeof SpaceSeoResponseSchema>;

export function isSpaceArchived(status: SpaceStatus): boolean {
  return status === "archived";
}

export function pickPrimaryPhotoStorageKey(
  photos: Array<{ storageKey: string; isPrimary: boolean; order: number }>,
): string | null {
  if (photos.length === 0) {
    return null;
  }

  const primary = photos.find((photo) => photo.isPrimary);
  if (primary) {
    return primary.storageKey;
  }

  return [...photos].sort((left, right) => left.order - right.order)[0]?.storageKey ?? null;
}

/** Maps validated API tariff inputs to DB centimes (enabled lines only). */
export function mapTariffInputsToDb(tariffs: SpaceTariffInput[]): Array<{
  durationClass: SpaceDurationClass;
  priceHT: number;
  vatRate: number;
  enabled: boolean;
}> {
  return tariffs
    .filter((tariff) => tariff.enabled)
    .map((tariff) => ({
      durationClass: tariff.durationClass,
      priceHT: eurosToCents(tariff.priceEuros),
      vatRate: tariff.vatRate,
      enabled: true,
    }));
}
