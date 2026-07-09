import { z } from "zod";

import { DURATION_CLASS_LABELS, SPACE_DURATION_CLASSES, SpaceTypeSchema } from "./spaces.js";

export const CatalogBuildingSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  city: z.string(),
  tagline: z.string().nullable(),
  primaryPhotoUrl: z.string().nullable(),
  isDefault: z.boolean(),
});

export const CatalogBuildingDetailSchema = CatalogBuildingSummarySchema.extend({
  description: z.string().nullable(),
  street: z.string(),
  postalCode: z.string(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
});

export const CatalogSpaceCardSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  capacity: z.number().int().min(1),
  equipments: z.array(z.string()).max(3),
  primaryPhotoUrl: z.string().nullable(),
  startingPriceHTCents: z.number().int().min(0).nullable(),
  startingPriceVatRate: z.number().min(0).nullable(),
  featuredOnVitrine: z.boolean(),
  vitrineOrder: z.number().int().min(0).optional(),
});

export const CatalogBuildingPageContentSchema = z.object({
  building: CatalogBuildingDetailSchema,
  spaces: z.array(CatalogSpaceCardSchema),
  visibleBuildings: z.array(CatalogBuildingSummarySchema),
});

export const CatalogBuildingsListSchema = z.object({
  buildings: z.array(CatalogBuildingSummarySchema),
  defaultBuildingSlug: z.string().nullable(),
});

export const CatalogTariffLineSchema = z.object({
  durationClass: z.enum(SPACE_DURATION_CLASSES),
  label: z.string(),
  priceHTCents: z.number().int().min(0),
  vatRate: z.number().min(0),
});

export const CatalogTariffSpaceGroupSchema = z.object({
  spaceId: z.string(),
  spaceName: z.string(),
  type: SpaceTypeSchema,
  lines: z.array(CatalogTariffLineSchema),
});

export const CatalogTariffBuildingGroupSchema = z.object({
  building: CatalogBuildingSummarySchema,
  spaceGroups: z.array(CatalogTariffSpaceGroupSchema),
});

export const CatalogTariffsContentSchema = z.object({
  visibleBuildings: z.array(CatalogBuildingSummarySchema),
  building: CatalogBuildingDetailSchema,
  groups: z.array(CatalogTariffSpaceGroupSchema),
});

export type CatalogBuildingSummary = z.infer<typeof CatalogBuildingSummarySchema>;
export type CatalogBuildingDetail = z.infer<typeof CatalogBuildingDetailSchema>;
export type CatalogSpaceCard = z.infer<typeof CatalogSpaceCardSchema>;
export type CatalogBuildingPageContent = z.infer<typeof CatalogBuildingPageContentSchema>;
export type CatalogBuildingsList = z.infer<typeof CatalogBuildingsListSchema>;
export type CatalogTariffLine = z.infer<typeof CatalogTariffLineSchema>;
export type CatalogTariffSpaceGroup = z.infer<typeof CatalogTariffSpaceGroupSchema>;
export type CatalogTariffsContent = z.infer<typeof CatalogTariffsContentSchema>;

export function computeStartingPriceHTCents(
  tariffs: ReadonlyArray<{ priceHT: number; enabled?: boolean }>,
): number | null {
  const enabledPrices = tariffs
    .filter((tariff) => tariff.enabled !== false)
    .map((tariff) => tariff.priceHT)
    .filter((price) => Number.isInteger(price) && price >= 0);

  if (enabledPrices.length === 0) {
    return null;
  }

  return Math.min(...enabledPrices);
}

export function pickStartingPriceVatRate(
  tariffs: ReadonlyArray<{ priceHT: number; vatRate: number; enabled?: boolean }>,
  startingPriceHTCents: number | null,
): number | null {
  if (startingPriceHTCents === null) {
    return null;
  }

  const match = tariffs.find(
    (tariff) => tariff.enabled !== false && tariff.priceHT === startingPriceHTCents,
  );
  return match?.vatRate ?? null;
}

export function durationClassLabel(durationClass: keyof typeof DURATION_CLASS_LABELS): string {
  return DURATION_CLASS_LABELS[durationClass];
}
