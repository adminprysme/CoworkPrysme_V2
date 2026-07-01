import type { Space } from "@coworkprysme/db";
import type { CreateSpaceRequest, SpaceResponse } from "@coworkprysme/shared";
import {
  SpaceResponseSchema,
  buildSpaceSeoMeta,
  iterateSlugCandidates,
  mapTariffInputsToDb,
  slugifySpaceName,
} from "@coworkprysme/shared";
import type { Types } from "mongoose";

type SpaceLean = Space & { _id: Types.ObjectId };

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeAccessCode(accessCode: string | undefined): string | undefined {
  return normalizeOptionalString(accessCode);
}

function normalizeDescription(description: string | undefined): string | undefined {
  return normalizeOptionalString(description);
}

export function mapTariffsToDb(tariffs: CreateSpaceRequest["tariffs"]) {
  return mapTariffInputsToDb(tariffs);
}

export function mapRequestToDbDocument(
  input: CreateSpaceRequest,
  buildingId: Types.ObjectId,
  seo: Space["seo"],
): Omit<Space, "createdAt" | "updatedAt" | "photos"> {
  return {
    buildingId,
    type: input.type,
    name: input.name.trim(),
    description: normalizeDescription(input.description),
    floor: input.floor.trim(),
    capacity: input.capacity,
    equipments: input.equipments.map((equipment) => ({
      key: equipment.key.trim(),
      label: equipment.label.trim(),
    })),
    openingHours: input.openingHours.map((entry) => ({
      day: entry.day,
      is24h: entry.is24h,
      open: entry.openTime,
      close: entry.closeTime,
    })),
    accessCode: normalizeAccessCode(input.accessCode),
    status: input.status,
    seo,
    tariffs: mapTariffsToDb(input.tariffs),
  };
}

export function mapSpaceToResponse(doc: SpaceLean): SpaceResponse {
  return SpaceResponseSchema.parse({
    id: doc._id.toString(),
    buildingId: doc.buildingId.toString(),
    type: doc.type,
    name: doc.name,
    description: normalizeDescription(doc.description),
    floor: String(doc.floor ?? ""),
    capacity: doc.capacity,
    equipments: doc.equipments.map((equipment) => ({
      key: equipment.key,
      label: equipment.label,
    })),
    openingHours: doc.openingHours.map((entry) => ({
      day: entry.day,
      is24h: entry.is24h,
      openTime: entry.open,
      closeTime: entry.close,
    })),
    accessCode: normalizeAccessCode(doc.accessCode),
    status: doc.status,
    photos: doc.photos.map((photo) => ({
      storageKey: photo.storageKey,
      alt: photo.alt,
      order: photo.order,
      isPrimary: photo.isPrimary,
    })),
    seo: {
      slug: doc.seo.slug,
      metaTitle: doc.seo.metaTitle,
      metaDescription: doc.seo.metaDescription,
    },
    tariffs: doc.tariffs.map((tariff) => ({
      durationClass: tariff.durationClass,
      priceHT: tariff.priceHT,
      vatRate: tariff.vatRate,
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  });
}

export function buildSpaceScopeFilter(buildingIds: Types.ObjectId[]): Record<string, unknown> {
  if (buildingIds.length === 0) {
    return {};
  }
  return { buildingId: { $in: buildingIds } };
}

export function isBuildingInScope(
  buildingId: Types.ObjectId,
  scopedIds: Types.ObjectId[],
): boolean {
  if (scopedIds.length === 0) {
    return true;
  }
  return scopedIds.some((id) => id.equals(buildingId));
}

export function buildSeoForSpace(name: string, description?: string): Space["seo"] {
  return buildSpaceSeoMeta(name, description);
}

export function resolveUniqueSlug(baseSlug: string, takenSlugs: Set<string>): string {
  for (const candidate of iterateSlugCandidates(baseSlug)) {
    if (!takenSlugs.has(candidate)) {
      return candidate;
    }
  }
  return `${baseSlug}-${Date.now()}`;
}

export function baseSlugForSpaceName(name: string): string {
  return slugifySpaceName(name);
}
