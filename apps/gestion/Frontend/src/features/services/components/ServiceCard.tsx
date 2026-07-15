import type { ServiceResponse } from "@coworkprysme/shared";
import { computeTtcCents, formatCentsAsEuroString } from "@coworkprysme/shared";

import { servicePhotoUrl } from "../../../lib/services-api.js";
import styles from "./ServiceCard.module.css";

interface ServiceCardProps {
  service: ServiceResponse;
  onEdit: () => void;
}

export function ServiceCard({ service, onEdit }: ServiceCardProps) {
  const ttc = formatCentsAsEuroString(computeTtcCents(service.priceHTCents, service.vatRate));

  return (
    <button type="button" className={styles.card} onClick={onEdit}>
      {service.photo?.url ? (
        <img
          className={styles.thumbnail}
          src={servicePhotoUrl(service.photo.url)}
          alt={service.photo.alt ?? service.label}
        />
      ) : null}
      <div className={styles.header}>
        <h3 className={styles.title}>{service.label}</h3>
        <span
          className={[
            styles.badge,
            service.status === "active" ? styles.badgeActive : styles.badgeInactive,
          ].join(" ")}
        >
          {service.status === "active" ? "Actif" : "Inactif"}
        </span>
      </div>
      {service.description ? <p className={styles.description}>{service.description}</p> : null}
      <dl className={styles.meta}>
        <div>
          <dt>Prix HT</dt>
          <dd>{service.priceEurosHT.toFixed(2)} €</dd>
        </div>
        <div>
          <dt>TVA</dt>
          <dd>{service.vatRate} %</dd>
        </div>
        <div>
          <dt>TTC indicatif</dt>
          <dd>{ttc} €</dd>
        </div>
      </dl>
      <p className={styles.footer}>
        <code>{service.key}</code>
        {service.isGlobal ? <span className={styles.scopeTag}>Global</span> : null}
        {!service.isGlobal && service.buildings?.length ? (
          <span className={styles.scopeTag}>
            {service.buildings.length} bâtiment{service.buildings.length > 1 ? "s" : ""}
          </span>
        ) : null}
        {service.promoEligible ? <span className={styles.promoTag}>Éligible 1+1</span> : null}
      </p>
    </button>
  );
}
