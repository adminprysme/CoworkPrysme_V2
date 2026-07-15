import type { ServiceResponse } from "@coworkprysme/shared";
import { computeTtcCents, formatCentsAsEuroString } from "@coworkprysme/shared";

import { servicePhotoUrl } from "../../../lib/services-api.js";
import styles from "./ServiceCard.module.css";

interface ServiceCardProps {
  service: ServiceResponse;
  onEdit: () => void;
  onDelete?: () => void;
}

function ServicePhotoFallback() {
  return (
    <div className={styles.mediaFallback} aria-hidden="true">
      <svg className={styles.mediaIcon} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="9" cy="10.5" r="1.75" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M6.5 16.5L10.2 12.8L13.1 15.7L16.4 12.4L18.5 14.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function ServiceCard({ service, onEdit, onDelete }: ServiceCardProps) {
  const ttc = formatCentsAsEuroString(computeTtcCents(service.priceHTCents, service.vatRate));
  const scopeTags: string[] = [];

  if (service.isGlobal) {
    scopeTags.push("Global");
  } else if (service.buildings?.length) {
    scopeTags.push(
      `${service.buildings.length} bâtiment${service.buildings.length > 1 ? "s" : ""}`,
    );
  }

  return (
    <article className={styles.cardShell}>
      <button type="button" className={styles.card} onClick={onEdit}>
        <div className={styles.media}>
          {service.photo?.url ? (
            <img
              className={styles.mediaImage}
              src={servicePhotoUrl(service.photo.url)}
              alt={service.photo.alt ?? service.label}
            />
          ) : (
            <ServicePhotoFallback />
          )}
        </div>

        <div className={styles.body}>
          <div className={styles.header}>
            <h3 className={styles.title}>{service.label}</h3>
            <span
              className={[
                styles.statusBadge,
                service.status === "active" ? styles.statusActive : styles.statusInactive,
              ].join(" ")}
            >
              {service.status === "active" ? "Actif" : "Inactif"}
            </span>
          </div>

          <p className={styles.description}>{service.description || "\u00A0"}</p>

          <div className={styles.priceBlock}>
            <div className={styles.pricePrimary}>
              <span className={styles.pricePrimaryLabel}>TTC indicatif</span>
              <span className={styles.pricePrimaryValue}>{ttc} €</span>
            </div>
            <p className={styles.priceSecondary}>
              HT {service.priceEurosHT.toFixed(2)} € · TVA {service.vatRate} %
            </p>
          </div>

          {scopeTags.length > 0 || service.promoEligible ? (
            <div className={styles.tags}>
              {scopeTags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
              {service.promoEligible ? <span className={styles.tag}>Éligible 1+1</span> : null}
            </div>
          ) : null}

          <p className={styles.keyLine}>
            <code className={styles.key}>{service.key}</code>
          </p>
        </div>
      </button>

      {onDelete ? (
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          Supprimer
        </button>
      ) : null}
    </article>
  );
}
