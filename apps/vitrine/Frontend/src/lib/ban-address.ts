/** BAN (api-adresse.data.gouv.fr) — mapping + fetch for booking address suggest. */

export const BAN_SEARCH_URL = "https://api-adresse.data.gouv.fr/search/";
export const BAN_DEBOUNCE_MS = 300;
export const BAN_TIMEOUT_MS = 4000;
export const BAN_MIN_QUERY_LENGTH = 3;
export const BAN_RESULT_LIMIT = 5;

export type BanAddressSuggestion = {
  label: string;
  street: string;
  zip: string;
  city: string;
};

export type BanFeatureProperties = {
  label?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
};

export type BanFeature = {
  properties?: BanFeatureProperties;
};

export type BanSearchResponse = {
  features?: BanFeature[];
};

/** Map a BAN GeoJSON feature to street / zip / city fields. */
export function mapBanFeatureToAddress(feature: BanFeature): BanAddressSuggestion | null {
  const props = feature.properties;
  if (!props) {
    return null;
  }

  const streetFromParts = [props.housenumber, props.street].filter(Boolean).join(" ").trim();
  const street = streetFromParts || props.name?.trim() || props.label?.split(",")[0]?.trim() || "";
  const zip = props.postcode?.trim() ?? "";
  const city = props.city?.trim() ?? "";
  const label = props.label?.trim() || [street, zip, city].filter(Boolean).join(" ");

  if (!street && !zip && !city) {
    return null;
  }

  return { label, street, zip, city };
}

export function mapBanResponseToSuggestions(payload: BanSearchResponse): BanAddressSuggestion[] {
  const features = payload.features ?? [];
  const mapped: BanAddressSuggestion[] = [];
  for (const feature of features) {
    const suggestion = mapBanFeatureToAddress(feature);
    if (suggestion) {
      mapped.push(suggestion);
    }
  }
  return mapped;
}

/**
 * Fetch BAN suggestions. On network/timeout/abort/HTTP errors returns []
 * (silent degrade — callers should treat empty as "no suggestions").
 */
export async function fetchBanAddressSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<BanAddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < BAN_MIN_QUERY_LENGTH) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmed,
    limit: String(BAN_RESULT_LIMIT),
  });

  const timeout = AbortSignal.timeout(BAN_TIMEOUT_MS);
  const combined =
    signal && typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timeout]) : timeout;

  try {
    const response = await fetch(`${BAN_SEARCH_URL}?${params}`, {
      method: "GET",
      signal: combined,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as BanSearchResponse;
    return mapBanResponseToSuggestions(payload);
  } catch {
    return [];
  }
}
