import { useEffect, useMemo, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import type { ServiceCustomAnswer, ServiceResponse } from "@coworkprysme/shared";

import pageStyles from "../../../BillingPages.module.css";
import type { WizardServicePick } from "../../../lib/quote-wizard-state.js";
import { QuoteServiceCard } from "../QuoteServiceCard.js";
import { ServiceDetailPanel } from "../ServiceDetailPanel.js";
import { serviceAnswersComplete } from "../QuoteServiceQuestionsForm.js";
import styles from "../QuoteWizard.module.css";

type ServicesStepProps = {
  catalog: ServiceResponse[];
  selected: WizardServicePick[];
  onChange: (next: WizardServicePick[]) => void;
};

export function ServicesStep({ catalog, selected, onChange }: ServicesStepProps) {
  const [search, setSearch] = useState("");
  const [focusedServiceId, setFocusedServiceId] = useState<string | null>(null);

  const selectedById = useMemo(
    () => new Map(selected.map((item) => [item.serviceId, item])),
    [selected],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...catalog].sort((a, b) => a.label.localeCompare(b.label, "fr"));
    if (!q) return list;
    return list.filter((service) => service.label.toLowerCase().includes(q));
  }, [catalog, search]);

  useEffect(() => {
    if (focusedServiceId && selectedById.has(focusedServiceId)) return;
    const last = selected[selected.length - 1];
    setFocusedServiceId(last?.serviceId ?? null);
  }, [selected, focusedServiceId, selectedById]);

  const focusedService = useMemo(() => {
    if (!focusedServiceId) return null;
    return catalog.find((service) => service.id === focusedServiceId) ?? null;
  }, [catalog, focusedServiceId]);

  const focusedPick = focusedServiceId ? selectedById.get(focusedServiceId) : undefined;

  function add(service: ServiceResponse) {
    setFocusedServiceId(service.id);
    if (selectedById.has(service.id)) return;
    onChange([
      ...selected,
      {
        serviceId: service.id,
        label: service.label,
        priceHTCents: service.priceHTCents,
        vatRate: service.vatRate,
        qty: 1,
        answerValues: {},
      },
    ]);
  }

  function remove(serviceId: string) {
    const next = selected.filter((item) => item.serviceId !== serviceId);
    onChange(next);
    if (focusedServiceId === serviceId) {
      setFocusedServiceId(next[next.length - 1]?.serviceId ?? null);
    }
  }

  function patch(
    serviceId: string,
    next: {
      qty?: number;
      answerValues?: Record<string, unknown>;
      customAnswers?: ServiceCustomAnswer[];
    },
  ) {
    onChange(selected.map((item) => (item.serviceId === serviceId ? { ...item, ...next } : item)));
  }

  const incompleteCount = selected.filter((pick) => {
    const service = catalog.find((item) => item.id === pick.serviceId);
    if (!service) return false;
    return !serviceAnswersComplete(service.customQuestions, pick.answerValues);
  }).length;

  return (
    <section className={styles.panel} aria-labelledby="quote-services-title">
      <h2 id="quote-services-title" className={styles.panelTitle}>
        Services
      </h2>
      <p className={pageStyles.muted}>
        Ajoutez des services optionnels. Quantité et questions obligatoires s’éditent dans le
        panneau.
      </p>

      <div className={`${styles.catalogFilters} ${styles.catalogFiltersSingle}`}>
        <label className={`${pageStyles.label} ${styles.filterSearch}`}>
          Rechercher
          <span className={styles.filterSearchField}>
            <IconSearch size={16} stroke={1.75} aria-hidden="true" />
            <input
              className={pageStyles.input}
              type="search"
              placeholder="Nom du service…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </span>
        </label>
      </div>

      {incompleteCount > 0 ? (
        <p className={styles.serviceIncompleteHint}>
          {incompleteCount} service{incompleteCount > 1 ? "s" : ""} à compléter (questions
          obligatoires).
        </p>
      ) : null}

      {selected.length > 1 ? (
        <div className={styles.selectedChips} aria-label="Services sélectionnés">
          {selected.map((pick) => (
            <button
              key={pick.serviceId}
              type="button"
              className={[
                styles.selectedChip,
                pick.serviceId === focusedServiceId ? styles.selectedChipActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setFocusedServiceId(pick.serviceId)}
            >
              {pick.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className={styles.splitLayout}>
        <div className={styles.splitMain}>
          {filtered.length === 0 ? (
            <p className={pageStyles.muted}>
              {catalog.length === 0
                ? "Aucun service actif."
                : "Aucun service ne correspond à la recherche."}
            </p>
          ) : (
            <div className={styles.catalogGridCompact}>
              {filtered.map((service) => {
                const pick = selectedById.get(service.id);
                return (
                  <QuoteServiceCard
                    key={service.id}
                    service={service}
                    selected={Boolean(pick)}
                    focused={focusedServiceId === service.id}
                    answerValues={pick?.answerValues ?? {}}
                    onAdd={() => add(service)}
                    onRemove={() => remove(service.id)}
                    onFocus={() => setFocusedServiceId(service.id)}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.splitSide}>
          {focusedService && focusedPick ? (
            <ServiceDetailPanel
              service={focusedService}
              qty={focusedPick.qty}
              answerValues={focusedPick.answerValues ?? {}}
              onPatch={(next) => patch(focusedService.id, next)}
              onRemove={() => remove(focusedService.id)}
            />
          ) : (
            <div className={styles.detailEmpty}>
              <p className={pageStyles.muted}>
                Ajoutez un service pour configurer la quantité et les questions.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
