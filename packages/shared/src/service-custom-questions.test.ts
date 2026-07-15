import { describe, expect, it } from "vitest";

import {
  MAX_SERVICE_CUSTOM_QUESTIONS,
  ServiceCustomQuestionsInputSchema,
  ensureServiceCustomQuestionIds,
  normalizeServiceCustomQuestions,
} from "./service-custom-questions.js";
import { mapCreateServiceRequestToDb } from "./services.js";

describe("service custom questions", () => {
  it("rejects more than the product limit of questions per service", () => {
    const questions = Array.from({ length: MAX_SERVICE_CUSTOM_QUESTIONS + 1 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      label: `Question ${index + 1}`,
      type: "short_text" as const,
      required: false,
      order: index,
    }));

    const result = ServiceCustomQuestionsInputSchema.safeParse(questions);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/Maximum 15 questions/);
    }
  });

  it("requires at least two unique options for select questions", () => {
    const result = ServiceCustomQuestionsInputSchema.safeParse([
      {
        label: "Menu souhaité",
        type: "select",
        required: true,
        order: 0,
        options: ["Entrée"],
      },
    ]);

    expect(result.success).toBe(false);
  });

  it("rejects duplicate question ids", () => {
    const duplicateId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const result = ServiceCustomQuestionsInputSchema.safeParse([
      {
        id: duplicateId,
        label: "Question A",
        type: "short_text",
        required: false,
        order: 0,
      },
      {
        id: duplicateId,
        label: "Question B",
        type: "number",
        required: true,
        order: 1,
      },
    ]);

    expect(result.success).toBe(false);
  });

  it("generates server-side ids when missing and normalizes order", () => {
    const normalized = normalizeServiceCustomQuestions([
      {
        label: "Date de l'événement",
        type: "date_range",
        required: false,
        order: 2,
      },
      {
        label: "Nombre de personnes ?",
        type: "number",
        required: true,
        order: 0,
      },
    ]);

    expect(normalized).toHaveLength(2);
    expect(normalized[0]?.label).toBe("Nombre de personnes ?");
    expect(normalized[0]?.order).toBe(0);
    expect(normalized[1]?.label).toBe("Date de l'événement");
    expect(normalized[1]?.order).toBe(1);
    expect(normalized[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(normalized[1]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("ensureServiceCustomQuestionIds assigns distinct ids to every question without one", () => {
    const withIds = ensureServiceCustomQuestionIds([
      {
        label: "Sans id A",
        type: "short_text",
        required: false,
        order: 0,
      },
      {
        label: "Sans id B",
        type: "long_text",
        required: false,
        order: 1,
      },
    ]);

    expect(withIds[0]?.id).toBeTruthy();
    expect(withIds[1]?.id).toBeTruthy();
    expect(withIds[0]?.id).not.toBe(withIds[1]?.id);
  });

  it("strips options from non-select questions on normalization", () => {
    const normalized = normalizeServiceCustomQuestions([
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        label: "Nombre de personnes ?",
        type: "number",
        required: true,
        order: 0,
      },
    ]);

    expect(normalized[0]).not.toHaveProperty("options");
  });

  it("preserves select options after normalization", () => {
    const normalized = normalizeServiceCustomQuestions([
      {
        id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        label: "Menu souhaité",
        type: "select",
        required: true,
        order: 0,
        options: [" Entrée ", "Plat", "Formule"],
      },
    ]);

    expect(normalized[0]?.options).toEqual(["Entrée", "Plat", "Formule"]);
  });

  it("mapCreateServiceRequestToDb generates ids server-side when questions omit them", () => {
    const dbShape = mapCreateServiceRequestToDb(
      {
        label: "Restauration événementielle",
        priceEurosHT: 50,
        vatRate: 20,
        promoEligible: false,
        status: "active",
        isGlobal: true,
        buildingIds: [],
        customQuestions: [
          {
            label: "Question sans id frontend",
            type: "short_text",
            required: false,
            order: 0,
          },
        ],
      },
      "restauration-evenementielle",
    );

    expect(dbShape.customQuestions).toHaveLength(1);
    expect(dbShape.customQuestions[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
