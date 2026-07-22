import type { ServicePromoEligibility } from "@coworkprysme/shared";

import type { PromoCodeFormValues } from "../utils/validation.js";
import styles from "./PromoPerimeterSection.module.css";

interface PromoPerimeterSectionProps {
  values: Pick<PromoCodeFormValues, "appliesTo" | "serviceKeys" | "discountType">;
  services: ServicePromoEligibility[];
  appliesToError?: string;
  serviceKeysError?: string;
  onChange: (patch: Pick<PromoCodeFormValues, "appliesTo" | "serviceKeys">) => void;
}

export function PromoPerimeterSection({
  values,
  services,
  appliesToError,
  serviceKeysError,
  onChange,
}: PromoPerimeterSectionProps) {
  const bogoLocked = values.discountType === "buy_one_get_one";

  const selectableServices =
    values.discountType === "buy_one_get_one"
      ? services.filter((service) => service.promoEligible && service.status !== "inactive")
      : services.filter((service) => service.status !== "inactive");

  const summaryTag =
    values.appliesTo === "order"
      ? "Toute la commande"
      : `${values.serviceKeys.length} sélectionné${values.serviceKeys.length > 1 ? "s" : ""}`;

  function setAppliesTo(appliesTo: PromoCodeFormValues["appliesTo"]) {
    if (bogoLocked && appliesTo === "order") {
      return;
    }
    onChange({
      appliesTo,
      serviceKeys: appliesTo === "order" ? [] : values.serviceKeys,
    });
  }

  function toggleService(serviceKey: string) {
    const selected = new Set(values.serviceKeys);
    if (selected.has(serviceKey)) {
      selected.delete(serviceKey);
    } else {
      selected.add(serviceKey);
    }
    onChange({ appliesTo: "service", serviceKeys: [...selected] });
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h3>Périmètre</h3>
        <span className={styles.summaryTag}>{summaryTag}</span>
      </div>

      <div className={styles.modeSwitch} role="group" aria-label="Périmètre du code promo">
        <button
          type="button"
          className={[styles.modeBtn, values.appliesTo === "order" ? styles.modeBtnActive : ""]
            .filter(Boolean)
            .join(" ")}
          disabled={bogoLocked}
          onClick={() => setAppliesTo("order")}
        >
          Toute la commande
        </button>
        <button
          type="button"
          className={[styles.modeBtn, values.appliesTo === "service" ? styles.modeBtnActive : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setAppliesTo("service")}
        >
          Services spécifiques
        </button>
      </div>

      {bogoLocked ? (
        <p className={styles.hint}>Le 1+1 s&apos;applique uniquement à des services spécifiques.</p>
      ) : null}

      {values.appliesTo === "service" ? (
        <div className={styles.servicesBlock}>
          {selectableServices.length === 0 ? (
            <p className={styles.hint}>Aucun service actif disponible.</p>
          ) : (
            <div className={styles.chipGrid}>
              {selectableServices.map((service) => {
                const checked = values.serviceKeys.includes(service.key);
                return (
                  <button
                    key={service.key}
                    type="button"
                    className={[styles.chip, checked ? styles.chipChecked : ""]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => toggleService(service.key)}
                  >
                    <span>
                      {service.label}
                      {!service.promoEligible ? " (non éligible 1+1)" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {appliesToError ? <p className={styles.error}>{appliesToError}</p> : null}
      {serviceKeysError ? <p className={styles.error}>{serviceKeysError}</p> : null}
    </section>
  );
}
