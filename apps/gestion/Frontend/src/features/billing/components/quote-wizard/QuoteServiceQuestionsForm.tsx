import {
  SERVICE_CUSTOM_QUESTION_TYPE_LABELS,
  type ServiceCustomAnswer,
  type ServiceCustomQuestion,
} from "@coworkprysme/shared";

import pageStyles from "../../BillingPages.module.css";
import styles from "./QuoteWizard.module.css";

type QuoteServiceQuestionsFormProps = {
  questions: ServiceCustomQuestion[];
  values: Record<string, unknown>;
  onChange: (questionId: string, value: unknown) => void;
  errors?: Record<string, string>;
};

export function QuoteServiceQuestionsForm({
  questions,
  values,
  onChange,
  errors = {},
}: QuoteServiceQuestionsFormProps) {
  if (questions.length === 0) return null;

  const sorted = [...questions].sort((left, right) => left.order - right.order);

  return (
    <div className={styles.serviceQuestions} onClick={(event) => event.stopPropagation()}>
      {sorted.map((question) => (
        <label key={question.id} className={styles.serviceQuestionField}>
          <span className={styles.serviceQuestionLabel}>
            {question.label}
            {question.required ? " *" : ""}
            <span className={styles.serviceQuestionType}>
              {SERVICE_CUSTOM_QUESTION_TYPE_LABELS[question.type]}
            </span>
          </span>
          {renderInput(question, values[question.id ?? ""], (value) => {
            if (question.id) onChange(question.id, value);
          })}
          {question.id && errors[question.id] ? (
            <span className={styles.serviceQuestionError}>{errors[question.id]}</span>
          ) : null}
        </label>
      ))}
    </div>
  );
}

function renderInput(
  question: ServiceCustomQuestion,
  value: unknown,
  onChange: (value: unknown) => void,
) {
  switch (question.type) {
    case "short_text":
      return (
        <input
          className={pageStyles.input}
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "long_text":
      return (
        <textarea
          className={pageStyles.input}
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "number":
      return (
        <input
          className={pageStyles.input}
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(event) =>
            onChange(event.target.value === "" ? "" : Number(event.target.value))
          }
        />
      );
    case "select":
      return (
        <select
          className={pageStyles.input}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Sélectionner…</option>
          {(question.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case "datetime":
      return (
        <input
          className={pageStyles.input}
          type="datetime-local"
          value={typeof value === "string" ? value.slice(0, 16) : ""}
          onChange={(event) => onChange(event.target.value ? `${event.target.value}:00+02:00` : "")}
        />
      );
    case "date_range":
      return (
        <div className={styles.rangeRow}>
          <input
            className={pageStyles.input}
            type="date"
            value={rangePart(value, "start")}
            onChange={(event) =>
              onChange({ start: event.target.value, end: rangePart(value, "end") })
            }
          />
          <input
            className={pageStyles.input}
            type="date"
            value={rangePart(value, "end")}
            onChange={(event) =>
              onChange({ start: rangePart(value, "start"), end: event.target.value })
            }
          />
        </div>
      );
    case "datetime_range":
      return (
        <div className={styles.rangeRow}>
          <input
            className={pageStyles.input}
            type="datetime-local"
            onChange={(event) =>
              onChange({
                start: event.target.value ? `${event.target.value}:00+02:00` : "",
                end: rangePart(value, "end"),
              })
            }
          />
          <input
            className={pageStyles.input}
            type="datetime-local"
            onChange={(event) =>
              onChange({
                start: rangePart(value, "start"),
                end: event.target.value ? `${event.target.value}:00+02:00` : "",
              })
            }
          />
        </div>
      );
    default:
      return null;
  }
}

function rangePart(value: unknown, key: "start" | "end"): string {
  if (typeof value === "object" && value !== null && key in value) {
    const part = (value as Record<string, unknown>)[key];
    return typeof part === "string" ? part : "";
  }
  return "";
}

export function buildCustomAnswersFromForm(
  questions: ServiceCustomQuestion[],
  values: Record<string, unknown>,
): ServiceCustomAnswer[] {
  return questions.flatMap((question) => {
    if (!question.id) return [];
    const value = values[question.id];
    if (value == null || value === "") return [];
    return [
      {
        questionId: question.id,
        type: question.type,
        label: question.label,
        value,
      },
    ];
  });
}

export function validateCustomQuestionForm(
  questions: ServiceCustomQuestion[],
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const question of questions) {
    if (!question.id || !question.required) continue;
    const value = values[question.id];
    if (value == null || value === "") {
      errors[question.id] = "Réponse obligatoire";
      continue;
    }
    if (
      (question.type === "date_range" || question.type === "datetime_range") &&
      typeof value === "object" &&
      value !== null
    ) {
      const range = value as { start?: unknown; end?: unknown };
      if (!range.start || !range.end) {
        errors[question.id] = "Réponse obligatoire";
      }
    }
  }
  return errors;
}

export function serviceAnswersComplete(
  questions: ServiceCustomQuestion[],
  values: Record<string, unknown> | undefined,
): boolean {
  return Object.keys(validateCustomQuestionForm(questions, values ?? {})).length === 0;
}
