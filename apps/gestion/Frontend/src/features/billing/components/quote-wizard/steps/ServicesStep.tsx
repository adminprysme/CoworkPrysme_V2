import type { ServiceResponse } from "@coworkprysme/shared";

import pageStyles from "../../../BillingPages.module.css";
import type { WizardServicePick } from "../../../lib/quote-wizard-state.js";
import { formatEuroFromCents } from "../../../lib/quote-wizard-state.js";
import styles from "../QuoteWizard.module.css";

type ServicesStepProps = {
  catalog: ServiceResponse[];
  selected: WizardServicePick[];
  onChange: (next: WizardServicePick[]) => void;
};

export function ServicesStep({ catalog, selected, onChange }: ServicesStepProps) {
  const selectedIds = new Set(selected.map((item) => item.serviceId));

  function toggle(service: ServiceResponse) {
    if (selectedIds.has(service.id)) {
      onChange(selected.filter((item) => item.serviceId !== service.id));
      return;
    }
    onChange([
      ...selected,
      {
        serviceId: service.id,
        label: service.label,
        priceHTCents: service.priceHTCents,
        vatRate: service.vatRate,
        qty: 1,
      },
    ]);
  }

  return (
    <section className={styles.panel} aria-labelledby="quote-services-title">
      <h2 id="quote-services-title" className={styles.panelTitle}>
        Services
      </h2>
      <p className={pageStyles.muted}>Ajoutez des services optionnels au devis (hors espaces).</p>

      {catalog.length === 0 ? (
        <p className={pageStyles.muted}>Aucun service actif.</p>
      ) : (
        <div className={styles.serviceList}>
          {catalog.map((service) => {
            const pick = selected.find((item) => item.serviceId === service.id);
            return (
              <div key={service.id} className={styles.serviceRow}>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" checked={Boolean(pick)} onChange={() => toggle(service)} />
                  <span>
                    {service.label}
                    <span className={pageStyles.muted}>
                      {" "}
                      — {formatEuroFromCents(service.priceHTCents)} HT
                    </span>
                  </span>
                </label>
                {pick ? (
                  <label className={pageStyles.label} style={{ minWidth: "6rem" }}>
                    Qté
                    <input
                      className={pageStyles.input}
                      type="number"
                      min={1}
                      value={pick.qty}
                      onChange={(event) => {
                        const qty = Math.max(1, Number(event.target.value) || 1);
                        onChange(
                          selected.map((item) =>
                            item.serviceId === service.id ? { ...item, qty } : item,
                          ),
                        );
                      }}
                    />
                  </label>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
