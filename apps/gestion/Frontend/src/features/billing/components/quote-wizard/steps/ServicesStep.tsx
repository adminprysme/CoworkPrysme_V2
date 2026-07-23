import type { ServiceResponse } from "@coworkprysme/shared";

import pageStyles from "../../../BillingPages.module.css";
import type { WizardServicePick } from "../../../lib/quote-wizard-state.js";
import { QuoteServiceCard } from "../QuoteServiceCard.js";
import styles from "../QuoteWizard.module.css";

type ServicesStepProps = {
  catalog: ServiceResponse[];
  selected: WizardServicePick[];
  onChange: (next: WizardServicePick[]) => void;
};

export function ServicesStep({ catalog, selected, onChange }: ServicesStepProps) {
  const selectedById = new Map(selected.map((item) => [item.serviceId, item]));

  function add(service: ServiceResponse) {
    if (selectedById.has(service.id)) return;
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

  function remove(serviceId: string) {
    onChange(selected.filter((item) => item.serviceId !== serviceId));
  }

  function setQty(serviceId: string, qty: number) {
    onChange(selected.map((item) => (item.serviceId === serviceId ? { ...item, qty } : item)));
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
        <div className={styles.catalogGrid}>
          {catalog.map((service) => {
            const pick = selectedById.get(service.id);
            return (
              <QuoteServiceCard
                key={service.id}
                service={service}
                selected={Boolean(pick)}
                qty={pick?.qty ?? 1}
                onAdd={() => add(service)}
                onRemove={() => remove(service.id)}
                onQtyChange={(qty) => setQty(service.id, qty)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
