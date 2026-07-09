import type { Building } from "@coworkprysme/db";
import type { BuildingResponse, CreateBuildingRequest } from "@coworkprysme/shared";
import {
  buildBuildingSeoMeta,
  resolveUniqueSlugFromSet,
  slugifyBuildingName,
} from "@coworkprysme/shared";
import type { Types } from "mongoose";

type BuildingLean = Building & { _id: Types.ObjectId };

function normalizeBuildingDescription(description: string | undefined): string | undefined {
  const trimmed = description?.trim();
  return trimmed ? trimmed : undefined;
}

export function mapRequestToDbDocument(
  input: CreateBuildingRequest,
  coordinates: { lat: number; lng: number },
): Omit<Building, "createdAt" | "updatedAt"> {
  return {
    name: input.name.trim(),
    description: normalizeBuildingDescription(input.description),
    phone: normalizeOptionalBuildingContactField(input.phone),
    email: normalizeOptionalBuildingContactField(input.email),
    address: {
      street: input.address.street.trim(),
      zip: input.address.postalCode.trim(),
      city: input.address.city.trim(),
      country: normalizeCountryToDb(input.address.country),
    },
    coordinates,
    floors: input.floors.map((floor) => ({ name: floor.name.trim() })),
    accessibilityHours: input.accessibilityHours.map((entry) => ({
      day: entry.day,
      is24h: entry.is24h,
      open: entry.openTime,
      close: entry.closeTime,
    })),
    receptionHours: input.receptionHours.map((entry) => ({
      day: entry.day,
      is24h: entry.is24h,
      open: entry.openTime,
      close: entry.closeTime,
    })),
    concierge: {
      url: input.concierge.link.trim(),
      accessCode: input.concierge.accessCode.trim(),
    },
    photos: [],
    status: input.status,
    visibleOnVitrine: input.visibleOnVitrine,
    isDefaultVitrineBuilding: input.isDefaultVitrineBuilding,
  };
}

export function mapBuildingToResponse(doc: BuildingLean): BuildingResponse {
  return BuildingResponseSchema.parse({
    id: doc._id.toString(),
    name: doc.name,
    description: normalizeBuildingDescription(doc.description),
    phone: doc.phone,
    email: doc.email,
    address: {
      street: doc.address.street,
      postalCode: doc.address.zip,
      city: doc.address.city,
      country: normalizeCountryFromDb(doc.address.country),
    },
    coordinates: {
      lat: doc.coordinates.lat,
      lng: doc.coordinates.lng,
    },
    floors: doc.floors.map((floor, index) => ({
      id: `${doc._id.toString()}-floor-${index}`,
      name: floor.name,
    })),
    status: doc.status,
    accessibilityHours: doc.accessibilityHours.map((entry) => ({
      day: entry.day,
      is24h: entry.is24h,
      openTime: entry.open,
      closeTime: entry.close,
    })),
    receptionHours: doc.receptionHours.map((entry) => ({
      day: entry.day,
      is24h: entry.is24h,
      openTime: entry.open,
      closeTime: entry.close,
    })),
    concierge: {
      link: doc.concierge.url,
      accessCode: doc.concierge.accessCode,
    },
    photos: doc.photos.map((photo) => ({
      storageKey: photo.storageKey,
      alt: photo.alt,
      order: photo.order,
      isPrimary: photo.isPrimary,
    })),
    visibleOnVitrine: doc.visibleOnVitrine ?? false,
    isDefaultVitrineBuilding: doc.isDefaultVitrineBuilding ?? false,
    seo: {
      slug: doc.seo.slug,
      metaTitle: doc.seo.metaTitle,
      metaDescription: doc.seo.metaDescription,
    },
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  });
}

export function buildSeoForBuilding(name: string, description?: string): BuildingLean["seo"] {
  return buildBuildingSeoMeta(name, description);
}

export function resolveUniqueBuildingSlug(baseSlug: string, takenSlugs: Set<string>): string {
  return resolveUniqueSlugFromSet(baseSlug, takenSlugs);
}

export function baseSlugForBuildingName(name: string): string {
  return slugifyBuildingName(name);
}

export function buildScopeFilter(buildingIds: Types.ObjectId[]): Record<string, unknown> {
  if (buildingIds.length === 0) {
    return {};
  }
  return { _id: { $in: buildingIds } };
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

/** Creating a building requires global scope (empty buildingIds). Scoped managers are read/update-only. */
export function canCreateBuilding(profile: { scope: { buildingIds: unknown[] } }): boolean {
  return profile.scope.buildingIds.length === 0;
}
