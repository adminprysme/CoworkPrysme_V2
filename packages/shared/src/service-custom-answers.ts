import {
  ServiceCustomAnswerSchema,
  ServiceCustomAnswerValueSchemas,
  type ServiceCustomAnswer,
  type ServiceCustomQuestion,
} from "./service-custom-questions.js";

export class ServiceCustomAnswerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceCustomAnswerValidationError";
  }
}

export function assertServiceCustomAnswers(
  questions: readonly ServiceCustomQuestion[],
  answers: readonly ServiceCustomAnswer[] | undefined,
): ServiceCustomAnswer[] {
  const provided = answers ?? [];
  const answersByQuestionId = new Map<string, ServiceCustomAnswer>();

  for (const answer of provided) {
    if (answersByQuestionId.has(answer.questionId)) {
      throw new ServiceCustomAnswerValidationError("Réponse en double pour une même question");
    }
    answersByQuestionId.set(answer.questionId, answer);
  }

  const validated: ServiceCustomAnswer[] = [];

  for (const question of questions) {
    const questionId = question.id;
    if (!questionId) {
      continue;
    }

    const answer = answersByQuestionId.get(questionId);
    if (!answer) {
      if (question.required) {
        throw new ServiceCustomAnswerValidationError(
          `La question « ${question.label} » est obligatoire`,
        );
      }
      continue;
    }

    if (answer.type !== question.type) {
      throw new ServiceCustomAnswerValidationError(
        `La réponse à « ${question.label} » ne correspond pas au type attendu`,
      );
    }

    const valueResult = ServiceCustomAnswerValueSchemas[question.type].safeParse(answer.value);
    if (!valueResult.success) {
      throw new ServiceCustomAnswerValidationError(
        `La réponse à « ${question.label} » est invalide`,
      );
    }

    validated.push(
      ServiceCustomAnswerSchema.parse({
        questionId,
        type: question.type,
        label: question.label,
        value: valueResult.data,
      }),
    );
    answersByQuestionId.delete(questionId);
  }

  if (answersByQuestionId.size > 0) {
    throw new ServiceCustomAnswerValidationError("Réponse fournie pour une question inconnue");
  }

  return validated;
}

/** Human-readable display of a custom answer value (staff / summary UI). */
export function formatServiceCustomAnswerValue(
  type: ServiceCustomQuestion["type"],
  value: unknown,
): string {
  if (value == null) {
    return "";
  }

  if (type === "date_range" && isRange(value)) {
    return `${formatDateOnly(value.start)} → ${formatDateOnly(value.end)}`;
  }

  if (type === "datetime_range" && isRange(value)) {
    return `${formatDateTime(value.start)} → ${formatDateTime(value.end)}`;
  }

  if (type === "datetime" && typeof value === "string") {
    return formatDateTime(value);
  }

  if (type === "number" && typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(value);
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isRange(value: unknown): value is { start: string; end: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "start" in value &&
    "end" in value &&
    typeof (value as { start: unknown }).start === "string" &&
    typeof (value as { end: unknown }).end === "string"
  );
}

function formatDateOnly(isoOrDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
    const [year, month, day] = isoOrDate.split("-");
    return `${day}/${month}/${year}`;
  }
  return formatDateTime(isoOrDate).split(" ")[0] ?? isoOrDate;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
