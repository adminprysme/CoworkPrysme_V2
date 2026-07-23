import { useMemo, useState } from "react";
import { IconPhoto } from "@tabler/icons-react";
import type { ServiceCustomAnswer, ServiceResponse } from "@coworkprysme/shared";

import { servicePhotoUrl } from "../../../../lib/services-api.js";
import { formatEuroFromCents } from "../../lib/quote-wizard-state.js";
import pageStyles from "../../BillingPages.module.css";
import {
  buildCustomAnswersFromForm,
  QuoteServiceQuestionsForm,
  serviceAnswersComplete,
  validateCustomQuestionForm,
} from "./QuoteServiceQuestionsForm.js";
import styles from "./QuoteWizard.module.css";

type ServiceDetailPanelProps = {
  service: ServiceResponse;
  qty: number;
  answerValues: Record<string, unknown>;
  onPatch: (patch: {
    qty?: number;
    answerValues?: Record<string, unknown>;
    customAnswers?: ServiceCustomAnswer[];
  }) => void;
  onRemove: () => void;
};

export function ServiceDetailPanel({
  service,
  qty,
  answerValues,
  onPatch,
  onRemove,
}: ServiceDetailPanelProps) {
  const photoPath = service.photo?.url;
  const [imgFailed, setImgFailed] = useState(false);
  const [touched, setTouched] = useState(false);
  const showPhoto = Boolean(photoPath) && !imgFailed;
  const hasQuestions = service.customQuestions.length > 0;
  const complete = serviceAnswersComplete(service.customQuestions, answerValues);
  const errors = useMemo(
    () => (touched ? validateCustomQuestionForm(service.customQuestions, answerValues) : {}),
    [answerValues, service.customQuestions, touched],
  );

  function patchAnswer(questionId: string, value: unknown) {
    const nextValues = { ...answerValues, [questionId]: value };
    const customAnswers = buildCustomAnswersFromForm(service.customQuestions, nextValues);
    setTouched(true);
    onPatch({
      answerValues: nextValues,
      customAnswers: customAnswers.length > 0 ? customAnswers : undefined,
    });
  }

  return (
    <aside className={styles.detailPanel} aria-label={`Configuration — ${service.label}`}>
      <div className={styles.detailBanner}>
        {showPhoto ? (
          <img
            className={styles.detailBannerImage}
            src={servicePhotoUrl(photoPath!)}
            alt={service.photo?.alt ?? ""}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className={styles.detailBannerFallback} data-kind="service" aria-hidden="true">
            <IconPhoto size={22} stroke={1.5} />
            <span>Service</span>
          </div>
        )}
      </div>

      <div className={styles.detailBody}>
        <div className={styles.detailHeader}>
          <h3 className={styles.detailTitle}>{service.label}</h3>
          <button type="button" className={pageStyles.secondaryButton} onClick={onRemove}>
            Retirer
          </button>
        </div>

        <p className={styles.catalogPrice}>
          {formatEuroFromCents(service.priceHTCents)} HT
          <span className={styles.catalogPriceMuted}> · TVA {service.vatRate} %</span>
        </p>

        <label className={pageStyles.label}>
          Quantité
          <input
            className={pageStyles.input}
            type="number"
            min={1}
            value={qty}
            onChange={(event) => onPatch({ qty: Math.max(1, Number(event.target.value) || 1) })}
          />
        </label>

        {hasQuestions ? (
          <QuoteServiceQuestionsForm
            questions={service.customQuestions}
            values={answerValues}
            onChange={patchAnswer}
            errors={errors}
          />
        ) : null}

        {hasQuestions && !complete ? (
          <p className={styles.serviceIncompleteHint}>
            Répondez aux questions obligatoires pour finaliser l’ajout.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
