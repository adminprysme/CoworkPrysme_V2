import { useState, type MouseEvent } from "react";
import { IconPhoto } from "@tabler/icons-react";
import type { ServiceResponse } from "@coworkprysme/shared";

import { servicePhotoUrl } from "../../../../lib/services-api.js";
import { formatEuroFromCents } from "../../lib/quote-wizard-state.js";
import pageStyles from "../../BillingPages.module.css";
import { serviceAnswersComplete } from "./QuoteServiceQuestionsForm.js";
import styles from "./QuoteWizard.module.css";

type QuoteServiceCardProps = {
  service: ServiceResponse;
  selected: boolean;
  focused?: boolean;
  answerValues: Record<string, unknown>;
  onAdd: () => void;
  onRemove: () => void;
  onFocus: () => void;
};

export function QuoteServiceCard({
  service,
  selected,
  focused = false,
  answerValues,
  onAdd,
  onRemove,
  onFocus,
}: QuoteServiceCardProps) {
  const photoPath = service.photo?.url;
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = Boolean(photoPath) && !imgFailed;
  const complete = serviceAnswersComplete(service.customQuestions, answerValues);

  function onCardClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) return;
    if (selected) {
      onFocus();
      return;
    }
    onAdd();
  }

  return (
    <article
      className={[
        styles.catalogCard,
        selected ? styles.catalogCardSelected : "",
        focused ? styles.catalogCardFocused : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-kind="service"
      data-selected={selected ? "true" : "false"}
      data-focused={focused ? "true" : "false"}
      data-complete={complete ? "true" : "false"}
      onClick={onCardClick}
    >
      <div className={styles.catalogMedia}>
        {showPhoto ? (
          <img
            className={styles.catalogMediaImage}
            src={servicePhotoUrl(photoPath!)}
            alt={service.photo?.alt ?? ""}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className={styles.catalogMediaFallback} data-kind="service" aria-hidden="true">
            <IconPhoto size={28} stroke={1.5} />
            <span>Service</span>
          </div>
        )}
        {selected ? (
          <span className={styles.selectedBadge}>{complete ? "Ajouté" : "À compléter"}</span>
        ) : null}
      </div>

      <div className={styles.catalogBody}>
        <h3 className={styles.catalogTitle}>{service.label}</h3>
        <p className={styles.catalogPrice}>
          {formatEuroFromCents(service.priceHTCents)} HT
          <span className={styles.catalogPriceMuted}> · TVA {service.vatRate} %</span>
        </p>

        <div className={styles.catalogActions}>
          {selected ? (
            <button
              type="button"
              className={pageStyles.secondaryButton}
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
            >
              Retirer
            </button>
          ) : (
            <button
              type="button"
              className={pageStyles.primaryButton}
              onClick={(event) => {
                event.stopPropagation();
                onAdd();
              }}
            >
              Ajouter
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
