import type { ServiceStatus } from "@coworkprysme/shared";
import { DEFAULT_SERVICE_VAT_RATE, SERVICE_DESCRIPTION_MAX_LENGTH } from "@coworkprysme/shared";

export interface ServiceFormValues {
  label: string;
  description: string;
  priceEurosHT: string;
  vatRate: string;
  promoEligible: boolean;
  status: ServiceStatus;
}

export type ServiceFormErrors = Partial<Record<keyof ServiceFormValues, string>>;

export function createEmptyServiceFormValues(): ServiceFormValues {
  return {
    label: "",
    description: "",
    priceEurosHT: "",
    vatRate: String(DEFAULT_SERVICE_VAT_RATE),
    promoEligible: false,
    status: "active",
  };
}

export function serviceResponseToFormValues(service: {
  label: string;
  description?: string;
  priceEurosHT: number;
  vatRate: number;
  promoEligible: boolean;
  status: ServiceStatus;
}): ServiceFormValues {
  return {
    label: service.label,
    description: service.description ?? "",
    priceEurosHT: service.priceEurosHT.toFixed(2),
    vatRate: String(service.vatRate),
    promoEligible: service.promoEligible,
    status: service.status,
  };
}

export function validateServiceForm(values: ServiceFormValues): ServiceFormErrors {
  const errors: ServiceFormErrors = {};
  const label = values.label.trim();
  if (!label) {
    errors.label = "Le nom est obligatoire";
  }

  if (values.description.trim().length > SERVICE_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Maximum ${SERVICE_DESCRIPTION_MAX_LENGTH} caractères`;
  }

  const price = Number.parseFloat(values.priceEurosHT);
  if (!Number.isFinite(price) || price < 0) {
    errors.priceEurosHT = "Saisissez un montant valide";
  } else if (!/^\d+(\.\d{1,2})?$/.test(values.priceEurosHT.trim())) {
    errors.priceEurosHT = "Maximum 2 décimales";
  }

  const vatRate = Number.parseFloat(values.vatRate);
  if (!Number.isFinite(vatRate) || vatRate < 0) {
    errors.vatRate = "Taux de TVA invalide";
  }

  return errors;
}

export function serviceFormValuesToCreateRequest(values: ServiceFormValues) {
  return {
    label: values.label.trim(),
    description: values.description.trim() || undefined,
    priceEurosHT: Number.parseFloat(values.priceEurosHT),
    vatRate: Number.parseFloat(values.vatRate),
    promoEligible: values.promoEligible,
    status: values.status,
  };
}
