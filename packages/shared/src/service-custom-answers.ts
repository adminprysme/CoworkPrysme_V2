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
