import { z } from "zod";

function createQuestionId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Product limit for service-specific questions shown during vitrine booking.
 * Keeps the client-facing form short enough to preserve conversion — a long
 * mandatory questionnaire at checkout would hurt completion rates.
 */
export const MAX_SERVICE_CUSTOM_QUESTIONS = 15;

export const SERVICE_CUSTOM_QUESTION_LABEL_MAX_LENGTH = 200;
export const SERVICE_CUSTOM_QUESTION_SELECT_MIN_OPTIONS = 2;

export const SERVICE_CUSTOM_QUESTION_TYPES = [
  "short_text",
  "long_text",
  "number",
  "select",
  "datetime",
  "date_range",
  "datetime_range",
] as const;

export const ServiceCustomQuestionTypeSchema = z.enum(SERVICE_CUSTOM_QUESTION_TYPES);
export type ServiceCustomQuestionType = z.infer<typeof ServiceCustomQuestionTypeSchema>;

export const SERVICE_CUSTOM_QUESTION_TYPE_LABELS: Record<ServiceCustomQuestionType, string> = {
  short_text: "Texte court",
  long_text: "Texte long",
  number: "Nombre",
  select: "Liste déroulante",
  datetime: "Date et heure",
  date_range: "Date de début – date de fin",
  datetime_range: "Date et heure de début – date et heure de fin",
};

const customQuestionLabelSchema = z
  .string()
  .trim()
  .min(1, "Le libellé est obligatoire")
  .max(SERVICE_CUSTOM_QUESTION_LABEL_MAX_LENGTH);

const customQuestionBaseFields = {
  label: customQuestionLabelSchema,
  required: z.boolean(),
  order: z.number().int().min(0),
};

const selectOptionsSchema = z
  .array(z.string().trim().min(1, "Chaque option doit avoir un libellé"))
  .min(
    SERVICE_CUSTOM_QUESTION_SELECT_MIN_OPTIONS,
    `Au moins ${SERVICE_CUSTOM_QUESTION_SELECT_MIN_OPTIONS} options sont requises`,
  );

function buildCustomQuestionInputVariants(idSchema: z.ZodString | z.ZodOptional<z.ZodString>) {
  return [
    z.object({ ...customQuestionBaseFields, id: idSchema, type: z.literal("short_text") }),
    z.object({ ...customQuestionBaseFields, id: idSchema, type: z.literal("long_text") }),
    z.object({ ...customQuestionBaseFields, id: idSchema, type: z.literal("number") }),
    z.object({
      ...customQuestionBaseFields,
      id: idSchema,
      type: z.literal("select"),
      options: selectOptionsSchema,
    }),
    z.object({ ...customQuestionBaseFields, id: idSchema, type: z.literal("datetime") }),
    z.object({ ...customQuestionBaseFields, id: idSchema, type: z.literal("date_range") }),
    z.object({ ...customQuestionBaseFields, id: idSchema, type: z.literal("datetime_range") }),
  ] as const;
}

export type ServiceCustomQuestionInput = {
  id?: string;
  label: string;
  type: ServiceCustomQuestionType;
  required: boolean;
  order: number;
  options?: string[];
};

export const ServiceCustomQuestionInputSchema = z.discriminatedUnion(
  "type",
  buildCustomQuestionInputVariants(z.string().uuid().optional()),
);

export const ServiceCustomQuestionSchema = z.discriminatedUnion(
  "type",
  buildCustomQuestionInputVariants(z.string().uuid()),
);

export type ServiceCustomQuestion = z.infer<typeof ServiceCustomQuestionSchema>;

export const ServiceCustomQuestionsInputSchema = z
  .array(ServiceCustomQuestionInputSchema)
  .max(
    MAX_SERVICE_CUSTOM_QUESTIONS,
    `Maximum ${MAX_SERVICE_CUSTOM_QUESTIONS} questions par service pour préserver l'expérience client au tunnel de réservation`,
  )
  .default([])
  .superRefine(validateServiceCustomQuestionsConfig);

export const ServiceCustomQuestionsSchema = z
  .array(ServiceCustomQuestionSchema)
  .max(MAX_SERVICE_CUSTOM_QUESTIONS)
  .default([]);

export type ServiceCustomQuestionsInput = z.infer<typeof ServiceCustomQuestionsInputSchema>;
export type ServiceCustomQuestions = z.infer<typeof ServiceCustomQuestionsSchema>;

export interface ServiceCustomQuestionDbShape {
  id: string;
  label: string;
  type: ServiceCustomQuestionType;
  required: boolean;
  options?: string[];
  order: number;
}

function validateServiceCustomQuestionsConfig(
  questions: ServiceCustomQuestionInput[],
  context: z.RefinementCtx,
): void {
  const seenIds = new Set<string>();

  for (const [index, question] of questions.entries()) {
    if (question.id) {
      if (seenIds.has(question.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Identifiant de question en double",
          path: [index, "id"],
        });
      }
      seenIds.add(question.id);
    }

    if (question.type === "select") {
      const normalizedOptions = (question.options ?? []).map((option) => option.trim());
      const uniqueOptions = new Set(normalizedOptions);
      if (uniqueOptions.size !== normalizedOptions.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Les options de la liste déroulante doivent être uniques",
          path: [index, "options"],
        });
      }
    } else if ("options" in question && question.options !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Les options ne sont autorisées que pour une liste déroulante",
        path: [index, "options"],
      });
    }
  }
}

export function ensureServiceCustomQuestionIds(
  questions: ServiceCustomQuestionInput[],
): Array<ServiceCustomQuestionDbShape & { type: ServiceCustomQuestionType }> {
  return questions.map((question) => {
    const id = question.id ?? createQuestionId();
    if (question.type === "select") {
      return {
        id,
        label: question.label,
        type: question.type,
        required: question.required,
        order: question.order,
        options: question.options ?? [],
      };
    }

    return {
      id,
      label: question.label,
      type: question.type,
      required: question.required,
      order: question.order,
    };
  });
}

export function normalizeServiceCustomQuestions(
  questions: ServiceCustomQuestionInput[],
): ServiceCustomQuestionDbShape[] {
  const withIds = ensureServiceCustomQuestionIds(questions);
  const sorted = [...withIds].sort((left, right) => left.order - right.order);

  return sorted.map((question, index) => {
    const normalized: ServiceCustomQuestionDbShape = {
      id: question.id,
      label: question.label.trim(),
      type: question.type,
      required: question.required,
      order: index,
    };

    if (question.type === "select") {
      normalized.options = (question.options ?? []).map((option) => option.trim());
    }

    return normalized;
  });
}

export function mapServiceCustomQuestionsToResponse(
  questions: ServiceCustomQuestionDbShape[] | undefined,
): ServiceCustomQuestions {
  const input: ServiceCustomQuestionInput[] = (questions ?? []).map((question) => {
    if (question.type === "select") {
      return {
        id: question.id,
        label: question.label,
        type: question.type,
        required: question.required,
        order: question.order,
        options: question.options ?? [],
      };
    }

    return {
      id: question.id,
      label: question.label,
      type: question.type,
      required: question.required,
      order: question.order,
    };
  });

  return ServiceCustomQuestionsSchema.parse(normalizeServiceCustomQuestions(input));
}

// ---------------------------------------------------------------------------
// Phase 2 (vitrine booking) — answer validation schemas (not wired yet).
// Answers attach to ReservationServiceSnapshot.customAnswers[] by questionId.
// ---------------------------------------------------------------------------

export const ServiceCustomAnswerValueSchemas = {
  short_text: z.string().trim().min(1),
  long_text: z.string().trim().min(1),
  number: z.number().finite(),
  select: z.string().trim().min(1),
  datetime: z.string().datetime({ offset: true }),
  date_range: z
    .object({
      start: z.string().date(),
      end: z.string().date(),
    })
    .superRefine((value, context) => {
      if (value.end <= value.start) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La date de fin doit être postérieure à la date de début",
          path: ["end"],
        });
      }
    }),
  datetime_range: z
    .object({
      start: z.string().datetime({ offset: true }),
      end: z.string().datetime({ offset: true }),
    })
    .superRefine((value, context) => {
      if (value.end <= value.start) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La date et heure de fin doivent être postérieures au début",
          path: ["end"],
        });
      }
    }),
} as const satisfies Record<ServiceCustomQuestionType, z.ZodType>;

export const ServiceCustomAnswerSchema = z.object({
  questionId: z.string().uuid(),
  type: ServiceCustomQuestionTypeSchema,
  label: z.string().trim().min(1),
  value: z.unknown(),
});

export type ServiceCustomAnswer = z.infer<typeof ServiceCustomAnswerSchema>;
