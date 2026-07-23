/** Re-export shared company lookup (gouv.fr + VAT) for vitrine booking. */
export {
  COMPANY_LOOKUP_TIMEOUT_MS,
  COMPANY_LOOKUP_URL,
  computeFrenchVatFromSiren,
  computeFrenchVatFromSiret,
  isValidSiretDigits,
  lookupCompanyBySiret,
  mapCompanyLookupHit,
  mapCompanyLookupResponse,
  mapEstablishmentAddress,
  normalizeSiretDigits,
  type CompanyLookupAddress,
  type CompanyLookupEstablishment,
  type CompanyLookupHit,
  type CompanyLookupOutcome,
  type CompanyLookupResponse,
  type CompanyLookupResult,
} from "@coworkprysme/shared";
