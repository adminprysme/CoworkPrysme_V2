import { BadRequestException, Injectable } from "@nestjs/common";
import type { BuildingAddressInput } from "@coworkprysme/shared";
import { normalizeCountryToDb } from "@coworkprysme/shared";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const NOMINATIM_USER_AGENT = "CoworkPrysme-Gestion/1.0 (contact@coworkprysme.fr)";

interface NominatimSearchResult {
  lat: string;
  lon: string;
}

/**
 * Server-side geocoding via Nominatim (OpenStreetMap).
 * Lives in gestion-api — packages/db stores coordinates only.
 * One request per create/update; never trusts client-supplied lat/lng.
 */
@Injectable()
export class GeocodingService {
  async geocodeAddress(address: BuildingAddressInput): Promise<{ lat: number; lng: number }> {
    const countryLabel =
      normalizeCountryToDb(address.country) === "FR" ? "France" : address.country.trim();

    const query = [address.street, address.postalCode, address.city, countryLabel]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ");

    if (!query) {
      throw new BadRequestException("Impossible de localiser cette adresse.");
    }

    const params = new URLSearchParams({
      format: "json",
      q: query,
      addressdetails: "0",
      limit: "1",
      countrycodes: "fr",
    });

    let response: Response;
    try {
      response = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": NOMINATIM_USER_AGENT,
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BadRequestException("Impossible de localiser cette adresse.");
    }

    if (!response.ok) {
      throw new BadRequestException("Impossible de localiser cette adresse.");
    }

    const results = (await response.json()) as NominatimSearchResult[];
    const first = results[0];
    if (!first) {
      throw new BadRequestException("Impossible de localiser cette adresse.");
    }

    const lat = Number.parseFloat(first.lat);
    const lng = Number.parseFloat(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException("Impossible de localiser cette adresse.");
    }

    return { lat, lng };
  }
}
