import type { BuildingAddress } from "../types.js";
import { formatAddressSummary } from "./schedule.js";

const NOMINATIM_BASE = "/nominatim";

interface NominatimAddress {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  country?: string;
}

export interface NominatimSearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: NominatimAddress;
}

export interface GeocodedAddress {
  address: BuildingAddress;
  lat: number;
  lng: number;
  label: string;
}

function buildStreet(address: NominatimAddress, displayName: string): string {
  const streetParts = [
    address.house_number,
    address.road ?? address.pedestrian ?? address.footway,
  ].filter(Boolean);
  if (streetParts.length > 0) {
    return streetParts.join(" ");
  }
  return displayName.split(",")[0]?.trim() ?? "";
}

export function parseNominatimResult(result: NominatimSearchResult): GeocodedAddress {
  const { address } = result;
  const city =
    address.city ?? address.town ?? address.village ?? address.municipality ?? address.county ?? "";

  const buildingAddress: BuildingAddress = {
    street: buildStreet(address, result.display_name),
    postalCode: address.postcode ?? "",
    city,
    country: address.country ?? "",
    accessInfo: "",
  };

  return {
    address: buildingAddress,
    lat: Number.parseFloat(result.lat),
    lng: Number.parseFloat(result.lon),
    label: formatAddressSummary(buildingAddress) || result.display_name,
  };
}

export async function searchAddresses(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodedAddress[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return [];
  }

  const params = new URLSearchParams({
    format: "json",
    q: trimmed,
    addressdetails: "1",
    limit: "6",
    countrycodes: "fr",
  });

  const response = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, { signal });
  if (!response.ok) {
    throw new Error("Impossible de rechercher l'adresse.");
  }

  const results = (await response.json()) as NominatimSearchResult[];
  return results.map(parseNominatimResult);
}

export async function geocodeAddress(address: BuildingAddress): Promise<GeocodedAddress | null> {
  const query = [address.street, address.postalCode, address.city, address.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");

  if (!query) {
    return null;
  }

  const results = await searchAddresses(query);
  return results[0] ?? null;
}

export async function ensureFormCoordinates(values: {
  address: BuildingAddress;
  lat: number | null;
  lng: number | null;
}): Promise<{ lat: number; lng: number } | null> {
  if (values.lat != null && values.lng != null) {
    return { lat: values.lat, lng: values.lng };
  }
  const geocoded = await geocodeAddress(values.address);
  if (!geocoded) {
    return null;
  }
  return { lat: geocoded.lat, lng: geocoded.lng };
}
