import type { ServiceCustomQuestionInput, ServiceCustomQuestionType } from "@coworkprysme/shared";
import {
  MAX_SERVICE_CUSTOM_QUESTIONS,
  SERVICE_CUSTOM_QUESTION_SELECT_MIN_OPTIONS,
  SERVICE_CUSTOM_QUESTION_TYPE_LABELS,
  SERVICE_CUSTOM_QUESTION_TYPES,
} from "@coworkprysme/shared";

import styles from "./ServiceCustomQuestionsSection.module.css";

export type ServiceCustomQuestionFormValue = ServiceCustomQuestionInput;

export interface ServiceCustomQuestionsSectionProps {
  questions: ServiceCustomQuestionFormValue[];
  errors: Record<number, string>;
  optionErrors: Record<string, string>;
  onChange: (questions: ServiceCustomQuestionFormValue[]) => void;
}

export function createEmptyCustomQuestion(order: number): ServiceCustomQuestionFormValue {
  return {
    id: crypto.randomUUID(),
    label: "",
    type: "short_text",
    required: false,
    order,
  };
}

export function ServiceCustomQuestionsSection({
  questions,
  errors,
  optionErrors,
  onChange,
}: ServiceCustomQuestionsSectionProps) {
  function patchQuestion(index: number, patch: Partial<ServiceCustomQuestionFormValue>) {
    const next = questions.map((question, questionIndex) => {
      if (questionIndex !== index) {
        return question;
      }

      const updated = { ...question, ...patch } as ServiceCustomQuestionFormValue;
      if (patch.type && patch.type !== "select" && updated.type !== "select") {
        const { options: _options, ...withoutOptions } =
          updated as ServiceCustomQuestionFormValue & {
            options?: string[];
          };
        return withoutOptions;
      }

      if (patch.type === "select" && updated.type === "select" && !("options" in updated)) {
        return { ...updated, options: ["", ""] };
      }

      return updated;
    });

    onChange(next);
  }

  function addQuestion() {
    if (questions.length >= MAX_SERVICE_CUSTOM_QUESTIONS) {
      return;
    }
    onChange([...questions, createEmptyCustomQuestion(questions.length)]);
  }

  function removeQuestion(index: number) {
    onChange(
      questions
        .filter((_, questionIndex) => questionIndex !== index)
        .map((question, questionIndex) => ({ ...question, order: questionIndex })),
    );
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) {
      return;
    }

    const next = [...questions];
    const [moved] = next.splice(index, 1);
    if (!moved) {
      return;
    }
    next.splice(targetIndex, 0, moved);
    onChange(next.map((question, questionIndex) => ({ ...question, order: questionIndex })));
  }

  function patchSelectOption(questionIndex: number, optionIndex: number, value: string) {
    const question = questions[questionIndex];
    if (!question || question.type !== "select" || !question.options) {
      return;
    }

    const options = [...question.options];
    options[optionIndex] = value;
    patchQuestion(questionIndex, { options });
  }

  function addSelectOption(questionIndex: number) {
    const question = questions[questionIndex];
    if (!question || question.type !== "select") {
      return;
    }

    patchQuestion(questionIndex, { options: [...(question.options ?? []), ""] });
  }

  function removeSelectOption(questionIndex: number, optionIndex: number) {
    const question = questions[questionIndex];
    if (!question || question.type !== "select" || !question.options) {
      return;
    }

    patchQuestion(questionIndex, {
      options: question.options.filter((_, index) => index !== optionIndex),
    });
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <h3>Questions de spécificité</h3>
          <p className={styles.intro}>
            Ces questions seront posées au client lorsqu&apos;il choisira ce service dans le tunnel
            de réservation vitrine. Limite produit : {MAX_SERVICE_CUSTOM_QUESTIONS} questions pour
            préserver la conversion.
          </p>
        </div>
        <button
          type="button"
          className={styles.addBtn}
          onClick={addQuestion}
          disabled={questions.length >= MAX_SERVICE_CUSTOM_QUESTIONS}
        >
          Ajouter une question
        </button>
      </div>

      {questions.length === 0 ? (
        <p className={styles.empty}>Aucune question configurée pour ce service.</p>
      ) : (
        <ol className={styles.list}>
          {questions.map((question, index) => {
            const selectOptions = question.type === "select" ? (question.options ?? []) : [];

            return (
              <li key={question.id ?? `new-${index}`} className={styles.item}>
                <div className={styles.itemHeader}>
                  <span className={styles.order}>{index + 1}</span>
                  <div className={styles.itemActions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label="Monter la question"
                      disabled={index === 0}
                      onClick={() => moveQuestion(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label="Descendre la question"
                      disabled={index === questions.length - 1}
                      onClick={() => moveQuestion(index, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => removeQuestion(index)}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>

                <label className={styles.field}>
                  <span>Libellé</span>
                  <input
                    className={styles.input}
                    value={question.label}
                    onChange={(event) => patchQuestion(index, { label: event.target.value })}
                  />
                </label>

                <label className={styles.field}>
                  <span>Type de réponse</span>
                  <select
                    className={styles.input}
                    value={question.type}
                    onChange={(event) =>
                      patchQuestion(index, {
                        type: event.target.value as ServiceCustomQuestionType,
                      })
                    }
                  >
                    {SERVICE_CUSTOM_QUESTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {SERVICE_CUSTOM_QUESTION_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.requiredToggle}>
                  <input
                    type="checkbox"
                    checked={question.required}
                    onChange={(event) => patchQuestion(index, { required: event.target.checked })}
                  />
                  <span>{question.required ? "Obligatoire" : "Non obligatoire"}</span>
                </label>

                {question.type === "select" ? (
                  <div className={styles.optionsBlock}>
                    <span className={styles.optionsTitle}>
                      Options de la liste (minimum {SERVICE_CUSTOM_QUESTION_SELECT_MIN_OPTIONS})
                    </span>
                    <ul className={styles.optionsList}>
                      {selectOptions.map((option, optionIndex) => (
                        <li key={`${index}-${optionIndex}`} className={styles.optionItem}>
                          <input
                            className={styles.input}
                            value={option}
                            onChange={(event) =>
                              patchSelectOption(index, optionIndex, event.target.value)
                            }
                            placeholder={`Option ${optionIndex + 1}`}
                          />
                          <button
                            type="button"
                            className={styles.iconBtn}
                            aria-label="Retirer l'option"
                            disabled={
                              selectOptions.length <= SERVICE_CUSTOM_QUESTION_SELECT_MIN_OPTIONS
                            }
                            onClick={() => removeSelectOption(index, optionIndex)}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => addSelectOption(index)}
                    >
                      Ajouter une option
                    </button>
                    {optionErrors[`${index}`] ? (
                      <span className={styles.error}>{optionErrors[`${index}`]}</span>
                    ) : null}
                  </div>
                ) : null}

                {errors[index] ? <span className={styles.error}>{errors[index]}</span> : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
