import { describe, expect, it } from "vitest";

import {
  assertServiceCustomAnswers,
  ServiceCustomAnswerValidationError,
} from "./service-custom-answers.js";
import type { ServiceCustomQuestion } from "./service-custom-questions.js";

const QUESTIONS: ServiceCustomQuestion[] = [
  {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    label: "Nombre de participants",
    type: "number",
    required: true,
    order: 0,
  },
  {
    id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
    label: "Commentaire",
    type: "short_text",
    required: false,
    order: 1,
  },
];

describe("assertServiceCustomAnswers", () => {
  it("rejects when a required question is unanswered", () => {
    expect(() => assertServiceCustomAnswers(QUESTIONS, [])).toThrow(
      ServiceCustomAnswerValidationError,
    );
    expect(() => assertServiceCustomAnswers(QUESTIONS, [])).toThrow(
      "La question « Nombre de participants » est obligatoire",
    );
  });

  it("validates required answers and ignores optional unanswered questions", () => {
    const validated = assertServiceCustomAnswers(QUESTIONS, [
      {
        questionId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        type: "number",
        label: "Nombre de participants",
        value: 12,
      },
    ]);

    expect(validated).toHaveLength(1);
    expect(validated[0]?.value).toBe(12);
  });

  it("rejects unknown question ids", () => {
    expect(() =>
      assertServiceCustomAnswers(QUESTIONS, [
        {
          questionId: "c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a13",
          type: "short_text",
          label: "Inconnue",
          value: "test",
        },
        {
          questionId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          type: "number",
          label: "Nombre de participants",
          value: 2,
        },
      ]),
    ).toThrow("Réponse fournie pour une question inconnue");
  });
});
