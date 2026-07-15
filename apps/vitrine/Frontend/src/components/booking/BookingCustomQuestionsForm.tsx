"use client";

import type { ServiceCustomAnswer, ServiceCustomQuestion } from "@coworkprysme/shared";
import { SERVICE_CUSTOM_QUESTION_TYPE_LABELS } from "@coworkprysme/shared";

import styles from "./BookingCustomQuestionsForm.module.css";

interface BookingCustomQuestionsFormProps {
  questions: ServiceCustomQuestion[];
  values: Record<string, unknown>;
  onChange: (questionId: string, value: unknown) => void;
  errors?: Record<string, string>;
}

export function BookingCustomQuestionsForm({
  questions,
  values,
  onChange,
  errors = {},
}: BookingCustomQuestionsFormProps) {
  if (questions.length === 0) {
    return null;
  }

  const sorted = [...questions].sort((left, right) => left.order - right.order);

  return (
    <div className={styles.form}>
      {sorted.map((question) => (
        <label key={question.id} className={styles.field}>
          <span className={styles.label}>
            {question.label}
            {question.required ? " *" : ""}
            <span className={styles.typeHint}>
              {SERVICE_CUSTOM_QUESTION_TYPE_LABELS[question.type]}
            </span>
          </span>
          {renderInput(question, values[question.id ?? ""], (value) => {
            if (question.id) {
              onChange(question.id, value);
            }
          })}
          {question.id && errors[question.id] ? (
            <span className={styles.error}>{errors[question.id]}</span>
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
          className={styles.input}
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "long_text":
      return (
        <textarea
          className={styles.textarea}
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "number":
      return (
        <input
          className={styles.input}
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
          className={styles.input}
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
          className={styles.input}
          type="datetime-local"
          value={typeof value === "string" ? value.slice(0, 16) : ""}
          onChange={(event) => onChange(event.target.value ? `${event.target.value}:00+02:00` : "")}
        />
      );
    case "date_range":
      return (
        <div className={styles.rangeRow}>
          <input
            className={styles.input}
            type="date"
            value={
              typeof value === "object" &&
              value !== null &&
              "start" in value &&
              typeof value.start === "string"
                ? value.start
                : ""
            }
            onChange={(event) =>
              onChange({
                start: event.target.value,
                end:
                  typeof value === "object" &&
                  value !== null &&
                  "end" in value &&
                  typeof value.end === "string"
                    ? value.end
                    : "",
              })
            }
          />
          <input
            className={styles.input}
            type="date"
            value={
              typeof value === "object" &&
              value !== null &&
              "end" in value &&
              typeof value.end === "string"
                ? value.end
                : ""
            }
            onChange={(event) =>
              onChange({
                start:
                  typeof value === "object" &&
                  value !== null &&
                  "start" in value &&
                  typeof value.start === "string"
                    ? value.start
                    : "",
                end: event.target.value,
              })
            }
          />
        </div>
      );
    case "datetime_range":
      return (
        <div className={styles.rangeRow}>
          <input
            className={styles.input}
            type="datetime-local"
            onChange={(event) =>
              onChange({
                start: event.target.value ? `${event.target.value}:00+02:00` : "",
                end:
                  typeof value === "object" &&
                  value !== null &&
                  "end" in value &&
                  typeof value.end === "string"
                    ? value.end
                    : "",
              })
            }
          />
          <input
            className={styles.input}
            type="datetime-local"
            onChange={(event) =>
              onChange({
                start:
                  typeof value === "object" &&
                  value !== null &&
                  "start" in value &&
                  typeof value.start === "string"
                    ? value.start
                    : "",
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

export function buildCustomAnswersFromForm(
  questions: ServiceCustomQuestion[],
  values: Record<string, unknown>,
): ServiceCustomAnswer[] {
  return questions.flatMap((question) => {
    if (!question.id) {
      return [];
    }
    const value = values[question.id];
    if (value == null || value === "") {
      return [];
    }

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
    if (!question.id || !question.required) {
      continue;
    }
    const value = values[question.id];
    if (value == null || value === "") {
      errors[question.id] = "Réponse obligatoire";
    }
  }

  return errors;
}
