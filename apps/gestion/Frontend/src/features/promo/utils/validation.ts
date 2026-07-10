import {
  assertDiscountCodeServiceTargets,
  DiscountCodeValidationError,
  type DiscountAppliesTo,
  type DiscountCodeDisplayStatus,
  type DiscountType,
  type ServicePromoEligibility,
} from "@coworkprysme/shared";

export interface PromoCodeFormValues {
  code: string;
  discountType: DiscountType;
  valuePercent: string;
  valueEuros: string;
  appliesTo: DiscountAppliesTo;
  serviceKeys: string[];
  stackable: boolean;
  expiresAt: string;
  maxUses: string;
  status: "active" | "disabled";
}

export type PromoCodeFormErrors = Partial<Record<string, string>>;

export function createEmptyPromoCodeFormValues(): PromoCodeFormValues {
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  const local = new Date(expires.getTime() - expires.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return {
    code: "",
    discountType: "percentage",
    valuePercent: "10",
    valueEuros: "5",
    appliesTo: "order",
    serviceKeys: [],
    stackable: false,
    expiresAt: local,
    maxUses: "",
    status: "active",
  };
}

export function discountCodeResponseToFormValues(code: {
  code: string;
  discountType: DiscountType;
  valuePercent?: number;
  valueEuros?: number;
  perimeter: { appliesTo: DiscountAppliesTo; serviceKeys?: string[] };
  stackable: boolean;
  expiresAt: string;
  maxUses?: number;
  status: "active" | "expired" | "disabled";
}): PromoCodeFormValues {
  const expiresAt = new Date(code.expiresAt);
  const local = new Date(expiresAt.getTime() - expiresAt.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return {
    code: code.code,
    discountType: code.discountType,
    valuePercent: code.valuePercent != null ? String(code.valuePercent) : "10",
    valueEuros: code.valueEuros != null ? code.valueEuros.toFixed(2) : "5",
    appliesTo: code.perimeter.appliesTo === "service" ? "service" : "order",
    serviceKeys: code.perimeter.serviceKeys ?? [],
    stackable: code.stackable,
    expiresAt: local,
    maxUses: code.maxUses != null ? String(code.maxUses) : "",
    status: code.status === "disabled" ? "disabled" : "active",
  };
}

export function validatePromoCodeForm(
  values: PromoCodeFormValues,
  services: ServicePromoEligibility[],
): PromoCodeFormErrors {
  const errors: PromoCodeFormErrors = {};
  const code = values.code.trim().toUpperCase();
  if (code.length < 3) {
    errors.code = "Le code doit contenir au moins 3 caractères";
  }

  if (!values.expiresAt) {
    errors.expiresAt = "La date d'expiration est obligatoire";
  } else {
    const expiresAt = new Date(values.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      errors.expiresAt = "Date invalide";
    }
  }

  if (values.discountType === "percentage") {
    const value = Number.parseFloat(values.valuePercent);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      errors.valuePercent = "Saisissez un pourcentage entre 0 et 100";
    }
  }

  if (values.discountType === "fixed_amount") {
    const value = Number.parseFloat(values.valueEuros);
    if (!Number.isFinite(value) || value <= 0) {
      errors.valueEuros = "Saisissez un montant strictement positif";
    } else if (!/^\d+(\.\d{1,2})?$/.test(values.valueEuros.trim())) {
      errors.valueEuros = "Maximum 2 décimales";
    }
  }

  if (values.discountType === "buy_one_get_one" && values.appliesTo !== "service") {
    errors.appliesTo = "Le type 1+1 nécessite un périmètre « services spécifiques »";
  }

  if (values.appliesTo === "service" && values.serviceKeys.length === 0) {
    errors.serviceKeys = "Sélectionnez au moins un service";
  }

  if (values.maxUses.trim()) {
    const maxUses = Number.parseInt(values.maxUses, 10);
    if (!Number.isFinite(maxUses) || maxUses < 1) {
      errors.maxUses = "Quota invalide";
    }
  }

  try {
    assertDiscountCodeServiceTargets(
      {
        discountType: values.discountType,
        perimeter: {
          appliesTo: values.appliesTo,
          serviceKeys: values.appliesTo === "service" ? values.serviceKeys : undefined,
        },
      },
      services,
    );
  } catch (error) {
    if (error instanceof DiscountCodeValidationError) {
      errors.serviceKeys = error.message;
    }
  }

  return errors;
}

export function promoCodeFormValuesToCreateRequest(values: PromoCodeFormValues) {
  const expiresAt = new Date(values.expiresAt);
  const payload = {
    kind: "promo" as const,
    code: values.code.trim().toUpperCase(),
    discountType: values.discountType,
    perimeter: {
      appliesTo: values.appliesTo,
      serviceKeys: values.appliesTo === "service" ? values.serviceKeys : undefined,
    },
    stackable: values.stackable,
    expiresAt: expiresAt.toISOString(),
    maxUses: values.maxUses.trim() ? Number.parseInt(values.maxUses, 10) : undefined,
    status: values.status,
  };

  if (values.discountType === "percentage") {
    return {
      ...payload,
      discountType: "percentage" as const,
      valuePercent: Number.parseFloat(values.valuePercent),
    };
  }
  if (values.discountType === "fixed_amount") {
    return {
      ...payload,
      discountType: "fixed_amount" as const,
      valueEuros: Number.parseFloat(values.valueEuros),
    };
  }
  return {
    ...payload,
    discountType: "buy_one_get_one" as const,
  };
}

export const DISPLAY_STATUS_LABELS: Record<DiscountCodeDisplayStatus, string> = {
  active: "Actif",
  expired: "Expiré",
  exhausted: "Épuisé",
  disabled: "Désactivé",
};
