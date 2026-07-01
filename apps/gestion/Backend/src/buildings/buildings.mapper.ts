import type { Building } from "@coworkprysme/db";
import type { BuildingResponse, CreateBuildingRequest } from "@coworkprysme/shared";
import {
  BuildingResponseSchema,
  normalizeCountryFromDb,
  normalizeCountryToDb,
} from "@coworkprysme/shared";
import type { Types } from "mongoose";

type BuildingLean = Building & { _id: Types.ObjectId };

export function mapRequestToDbDocument(
  input: CreateBuildingRequest,
  coordinates: { lat: number; lng: number },
): Omit<Building, "createdAt" | "updatedAt"> {
  return {
    name: input.name.trim(),
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
  };
}

export function mapBuildingToResponse(doc: BuildingLean): BuildingResponse {
  return BuildingResponseSchema.parse({
    id: doc._id.toString(),
    name: doc.name,
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
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  });
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
