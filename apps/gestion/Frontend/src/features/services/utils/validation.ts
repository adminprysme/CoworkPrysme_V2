import type {
  ServiceCustomQuestionInput,
  ServiceEditMode,
  ServiceStatus,
} from "@coworkprysme/shared";
import {
  DEFAULT_SERVICE_VAT_RATE,
  MAX_SERVICE_CUSTOM_QUESTIONS,
  SERVICE_CUSTOM_QUESTION_SELECT_MIN_OPTIONS,
  SERVICE_DESCRIPTION_MAX_LENGTH,
  ServiceCustomQuestionsInputSchema,
} from "@coworkprysme/shared";

export interface ServiceFormValues {
  label: string;
  description: string;
  priceEurosHT: string;
  vatRate: string;
  promoEligible: boolean;
  status: ServiceStatus;
  customQuestions: ServiceCustomQuestionInput[];
  isGlobal: boolean;
  buildingIds: string[];
}

export interface ServiceFormErrors {
  label?: string;
  description?: string;
  priceEurosHT?: string;
  vatRate?: string;
  customQuestions?: string;
  buildingIds?: string;
  customQuestionByIndex?: Record<number, string>;
  customQuestionOptionsByIndex?: Record<number, string>;
}

export function createEmptyServiceFormValues(isAdmin = false): ServiceFormValues {
  return {
    label: "",
    description: "",
    priceEurosHT: "",
    vatRate: String(DEFAULT_SERVICE_VAT_RATE),
    promoEligible: false,
    status: "active",
    customQuestions: [],
    isGlobal: isAdmin,
    buildingIds: [],
  };
}

export function serviceResponseToFormValues(service: {
  label: string;
  description?: string;
  priceEurosHT: number;
  vatRate: number;
  promoEligible: boolean;
  status: ServiceStatus;
  customQuestions?: ServiceCustomQuestionInput[];
  isGlobal: boolean;
  buildingIds: string[];
}): ServiceFormValues {
  return {
    label: service.label,
    description: service.description ?? "",
    priceEurosHT: service.priceEurosHT.toFixed(2),
    vatRate: String(service.vatRate),
    promoEligible: service.promoEligible,
    status: service.status,
    customQuestions: (service.customQuestions ?? []).map((question, index) => {
      if (question.type === "select") {
        return {
          ...question,
          order: index,
          options: [...(question.options ?? [])],
        };
      }

      return {
        ...question,
        order: index,
      };
    }),
    isGlobal: service.isGlobal,
    buildingIds: [...service.buildingIds],
  };
}

export function validateServiceForm(
  values: ServiceFormValues,
  options?: { skipAvailability?: boolean },
): ServiceFormErrors {
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

  if (!options?.skipAvailability && !values.isGlobal && values.buildingIds.length === 0) {
    errors.buildingIds = "Sélectionnez au moins un bâtiment";
  }

  if (values.customQuestions.length > MAX_SERVICE_CUSTOM_QUESTIONS) {
    errors.customQuestions = `Maximum ${MAX_SERVICE_CUSTOM_QUESTIONS} questions par service`;
  }

  const customQuestionByIndex: Record<number, string> = {};
  const customQuestionOptionsByIndex: Record<number, string> = {};

  values.customQuestions.forEach((question, index) => {
    if (!question.label.trim()) {
      customQuestionByIndex[index] = "Le libellé est obligatoire";
    }

    if (question.type === "select") {
      const options = question.options ?? [];
      const filledOptions = options.map((option) => option.trim()).filter(Boolean);
      if (filledOptions.length < SERVICE_CUSTOM_QUESTION_SELECT_MIN_OPTIONS) {
        customQuestionOptionsByIndex[index] =
          `Au moins ${SERVICE_CUSTOM_QUESTION_SELECT_MIN_OPTIONS} options sont requises`;
      } else if (new Set(filledOptions).size !== filledOptions.length) {
        customQuestionOptionsByIndex[index] = "Les options doivent être uniques";
      }
    }
  });

  const parsedQuestions = ServiceCustomQuestionsInputSchema.safeParse(
    values.customQuestions.map((question, index) => ({
      ...question,
      label: question.label.trim(),
      order: index,
      ...(question.type === "select"
        ? {
            options: (question.options ?? []).map((option) => option.trim()).filter(Boolean),
          }
        : {}),
    })),
  );

  if (!parsedQuestions.success) {
    for (const issue of parsedQuestions.error.issues) {
      const index = typeof issue.path[0] === "number" ? issue.path[0] : undefined;
      if (index === undefined) {
        errors.customQuestions = issue.message;
        continue;
      }

      if (issue.path[1] === "options") {
        customQuestionOptionsByIndex[index] = issue.message;
      } else if (!customQuestionByIndex[index]) {
        customQuestionByIndex[index] = issue.message;
      }
    }
  }

  if (Object.keys(customQuestionByIndex).length > 0) {
    errors.customQuestionByIndex = customQuestionByIndex;
  }
  if (Object.keys(customQuestionOptionsByIndex).length > 0) {
    errors.customQuestionOptionsByIndex = customQuestionOptionsByIndex;
  }

  return errors;
}

function mapCustomQuestions(values: ServiceFormValues) {
  return values.customQuestions.map((question, index) => ({
    ...question,
    id: question.id,
    label: question.label.trim(),
    order: index,
    ...(question.type === "select"
      ? {
          options: (question.options ?? []).map((option) => option.trim()).filter(Boolean),
        }
      : {}),
  }));
}

export function serviceFormValuesToCreateRequest(values: ServiceFormValues) {
  return {
    label: values.label.trim(),
    description: values.description.trim() || undefined,
    priceEurosHT: Number.parseFloat(values.priceEurosHT),
    vatRate: Number.parseFloat(values.vatRate),
    promoEligible: values.promoEligible,
    status: values.status,
    customQuestions: mapCustomQuestions(values),
    isGlobal: values.isGlobal,
    buildingIds: values.isGlobal ? [] : values.buildingIds,
  };
}

export function serviceFormValuesToUpdateRequest(
  values: ServiceFormValues,
  editMode: ServiceEditMode,
) {
  if (editMode === "price_only") {
    return {
      priceEurosHT: Number.parseFloat(values.priceEurosHT),
      vatRate: Number.parseFloat(values.vatRate),
    };
  }

  return serviceFormValuesToCreateRequest(values);
}

export function hasServiceFormErrors(errors: ServiceFormErrors): boolean {
  return (
    Boolean(errors.label) ||
    Boolean(errors.description) ||
    Boolean(errors.priceEurosHT) ||
    Boolean(errors.vatRate) ||
    Boolean(errors.buildingIds) ||
    Boolean(errors.customQuestions) ||
    Boolean(errors.customQuestionByIndex && Object.keys(errors.customQuestionByIndex).length > 0) ||
    Boolean(
      errors.customQuestionOptionsByIndex &&
      Object.keys(errors.customQuestionOptionsByIndex).length > 0,
    )
  );
}
