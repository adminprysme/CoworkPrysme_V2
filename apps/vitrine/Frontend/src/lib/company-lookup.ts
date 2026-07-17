/** Company lookup via recherche-entreprises.api.gouv.fr + French VAT helper. */

export const COMPANY_LOOKUP_URL = "https://recherche-entreprises.api.gouv.fr/search";
export const COMPANY_LOOKUP_TIMEOUT_MS = 6000;

export type CompanyLookupAddress = {
  street: string;
  zip: string;
  city: string;
};

export type CompanyLookupResult = {
  legalName: string;
  siret: string;
  vatNumber: string;
  address: CompanyLookupAddress;
};

export type CompanyLookupEstablishment = {
  siret?: string;
  adresse?: string;
  code_postal?: string;
  libelle_commune?: string;
  numero_voie?: string | null;
  type_voie?: string | null;
  libelle_voie?: string | null;
  complement_adresse?: string | null;
};

export type CompanyLookupHit = {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  siege?: CompanyLookupEstablishment;
  matching_etablissements?: CompanyLookupEstablishment[];
};

export type CompanyLookupResponse = {
  results?: CompanyLookupHit[];
};

export function normalizeSiretDigits(value: string): string {
  return value.replaceAll(/\D/g, "");
}

export function isValidSiretDigits(value: string): boolean {
  return /^\d{14}$/.test(normalizeSiretDigits(value));
}

/**
 * Official French intracom VAT key from SIREN:
 * FR + (12 + 3 × (SIREN mod 97)) mod 97, zero-padded to 2 digits.
 */
export function computeFrenchVatFromSiren(siren: string): string {
  const digits = siren.replaceAll(/\D/g, "");
  if (!/^\d{9}$/.test(digits)) {
    throw new Error("SIREN must contain exactly 9 digits");
  }
  const sirenNumber = Number.parseInt(digits, 10);
  const key = (12 + 3 * (sirenNumber % 97)) % 97;
  return `FR${String(key).padStart(2, "0")}${digits}`;
}

export function computeFrenchVatFromSiret(siret: string): string {
  const digits = normalizeSiretDigits(siret);
  if (!/^\d{14}$/.test(digits)) {
    throw new Error("SIRET must contain exactly 14 digits");
  }
  return computeFrenchVatFromSiren(digits.slice(0, 9));
}

function titleCaseCity(city: string): string {
  const trimmed = city.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed
    .toLocaleLowerCase("fr-FR")
    .split(/([\s'-]+)/)
    .map((part) => {
      if (/^[\s'-]+$/.test(part)) {
        return part;
      }
      return part.charAt(0).toLocaleUpperCase("fr-FR") + part.slice(1);
    })
    .join("");
}

export function mapEstablishmentAddress(
  establishment: CompanyLookupEstablishment,
): CompanyLookupAddress {
  const streetFromParts = [
    establishment.numero_voie,
    establishment.type_voie,
    establishment.libelle_voie,
  ]
    .filter((part) => Boolean(part && String(part).trim()))
    .join(" ")
    .trim();

  let street = streetFromParts;
  if (!street && establishment.adresse) {
    const zip = establishment.code_postal?.trim() ?? "";
    const city = establishment.libelle_commune?.trim() ?? "";
    street = establishment.adresse
      .replace(new RegExp(`\\s*${zip}\\s*${city}\\s*$`, "i"), "")
      .trim();
  }

  const complement = establishment.complement_adresse?.trim();
  if (complement) {
    street = street ? `${street}, ${complement}` : complement;
  }

  return {
    street,
    zip: establishment.code_postal?.trim() ?? "",
    city: titleCaseCity(establishment.libelle_commune ?? ""),
  };
}

function pickEstablishment(
  hit: CompanyLookupHit,
  siretDigits: string,
): CompanyLookupEstablishment | null {
  const matching = hit.matching_etablissements?.find(
    (item) => normalizeSiretDigits(item.siret ?? "") === siretDigits,
  );
  if (matching) {
    return matching;
  }
  if (hit.siege && normalizeSiretDigits(hit.siege.siret ?? "") === siretDigits) {
    return hit.siege;
  }
  return null;
}

export function mapCompanyLookupHit(
  hit: CompanyLookupHit,
  siretDigits: string,
): CompanyLookupResult | null {
  const establishment = pickEstablishment(hit, siretDigits);
  if (!establishment) {
    return null;
  }

  const legalName = (hit.nom_raison_sociale ?? hit.nom_complet ?? "").trim();
  if (!legalName) {
    return null;
  }

  const resolvedSiret = normalizeSiretDigits(establishment.siret ?? siretDigits);
  if (!/^\d{14}$/.test(resolvedSiret)) {
    return null;
  }

  return {
    legalName,
    siret: resolvedSiret,
    vatNumber: computeFrenchVatFromSiret(resolvedSiret),
    address: mapEstablishmentAddress(establishment),
  };
}

export type CompanyLookupOutcome =
  | { status: "ok"; company: CompanyLookupResult }
  | { status: "invalid_siret" }
  | { status: "not_found" }
  | { status: "unavailable" };

export function mapCompanyLookupResponse(
  payload: CompanyLookupResponse,
  siretDigits: string,
): CompanyLookupOutcome {
  if (!isValidSiretDigits(siretDigits)) {
    return { status: "invalid_siret" };
  }

  const results = payload.results ?? [];
  for (const hit of results) {
    const mapped = mapCompanyLookupHit(hit, siretDigits);
    if (mapped) {
      return { status: "ok", company: mapped };
    }
  }

  return { status: "not_found" };
}

export async function lookupCompanyBySiret(
  siret: string,
  signal?: AbortSignal,
): Promise<CompanyLookupOutcome> {
  const siretDigits = normalizeSiretDigits(siret);
  if (!isValidSiretDigits(siretDigits)) {
    return { status: "invalid_siret" };
  }

  const params = new URLSearchParams({
    q: siretDigits,
    page: "1",
    per_page: "1",
  });

  const timeout = AbortSignal.timeout(COMPANY_LOOKUP_TIMEOUT_MS);
  const combined =
    signal && typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timeout]) : timeout;

  try {
    const response = await fetch(`${COMPANY_LOOKUP_URL}?${params}`, {
      method: "GET",
      signal: combined,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return { status: "unavailable" };
    }
    const payload = (await response.json()) as CompanyLookupResponse;
    return mapCompanyLookupResponse(payload, siretDigits);
  } catch {
    return { status: "unavailable" };
  }
}
