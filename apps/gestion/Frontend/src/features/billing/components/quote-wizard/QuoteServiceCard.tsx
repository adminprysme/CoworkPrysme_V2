import { useState } from "react";
import { IconPhoto } from "@tabler/icons-react";
import type { ServiceResponse } from "@coworkprysme/shared";

import { servicePhotoUrl } from "../../../../lib/services-api.js";
import { formatEuroFromCents } from "../../lib/quote-wizard-state.js";
import pageStyles from "../../BillingPages.module.css";
import styles from "./QuoteWizard.module.css";

type QuoteServiceCardProps = {
  service: ServiceResponse;
  selected: boolean;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  onQtyChange: (qty: number) => void;
};

export function QuoteServiceCard({
  service,
  selected,
  qty,
  onAdd,
  onRemove,
  onQtyChange,
}: QuoteServiceCardProps) {
  const photoPath = service.photo?.url;
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = Boolean(photoPath) && !imgFailed;

  return (
    <article
      className={`${styles.catalogCard} ${selected ? styles.catalogCardSelected : ""}`}
      data-kind="service"
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
        {selected ? <span className={styles.selectedBadge}>Ajouté</span> : null}
      </div>

      <div className={styles.catalogBody}>
        <h3 className={styles.catalogTitle}>{service.label}</h3>
        <p className={styles.catalogPrice}>
          {formatEuroFromCents(service.priceHTCents)} HT
          <span className={styles.catalogPriceMuted}> · TVA {service.vatRate} %</span>
        </p>

        <div className={styles.catalogActions}>
          {selected ? (
            <>
              <label className={pageStyles.label} style={{ minWidth: "5.5rem", flex: "0 0 auto" }}>
                Qté
                <input
                  className={pageStyles.input}
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(event) => onQtyChange(Math.max(1, Number(event.target.value) || 1))}
                />
              </label>
              <button type="button" className={pageStyles.secondaryButton} onClick={onRemove}>
                Retirer
              </button>
            </>
          ) : (
            <button type="button" className={pageStyles.primaryButton} onClick={onAdd}>
              Ajouter
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
