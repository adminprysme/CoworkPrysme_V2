"use client";

import type { BookingServiceCatalogItem, ServiceCustomAnswer } from "@coworkprysme/shared";
import { formatCentsAsEuroString } from "@coworkprysme/shared";
import Image from "next/image";
import { useMemo, useState } from "react";

import { QuantityStepper } from "@/components/ui/QuantityStepper";

import {
  BookingCustomQuestionsForm,
  buildCustomAnswersFromForm,
  validateCustomQuestionForm,
} from "./BookingCustomQuestionsForm";
import { BOOKING_SERVICE_CARD_IMAGE_SIZES } from "./booking-image-sizes";
import styles from "./BookingServicesStep.module.css";

export type BookingCartItem = {
  serviceId: string;
  label: string;
  qty: number;
  customAnswers?: ServiceCustomAnswer[];
};

interface BookingServicesStepProps {
  services: BookingServiceCatalogItem[];
  cart: BookingCartItem[];
  loading: boolean;
  onCartChange: (cart: BookingCartItem[]) => void;
  onBack: () => void;
}

export function BookingServicesStep({
  services,
  cart,
  loading,
  onCartChange,
  onBack,
}: BookingServicesStepProps) {
  const [draftAnswers, setDraftAnswers] = useState<Record<string, Record<string, unknown>>>({});
  const [formErrors, setFormErrors] = useState<Record<string, Record<string, string>>>({});
  const [expandedConfig, setExpandedConfig] = useState<Record<string, boolean>>({});

  const cartByServiceId = useMemo(
    () => new Map(cart.map((item) => [item.serviceId, item])),
    [cart],
  );

  function updateQty(service: BookingServiceCatalogItem, qty: number) {
    if (qty <= 0) {
      onCartChange(cart.filter((item) => item.serviceId !== service.id));
      setExpandedConfig((current) => {
        const next = { ...current };
        delete next[service.id];
        return next;
      });
      return;
    }

    const existing = cartByServiceId.get(service.id);
    const answers =
      existing?.customAnswers ??
      buildCustomAnswersFromForm(service.customQuestions, draftAnswers[service.id] ?? {});

    if (service.customQuestions.some((question) => question.required)) {
      const errors = validateCustomQuestionForm(
        service.customQuestions,
        draftAnswers[service.id] ?? {},
      );
      if (Object.keys(errors).length > 0) {
        setFormErrors((current) => ({ ...current, [service.id]: errors }));
        setExpandedConfig((current) => ({ ...current, [service.id]: true }));
        return;
      }
    }

    const nextItem: BookingCartItem = {
      serviceId: service.id,
      label: service.label,
      qty,
      customAnswers: answers.length > 0 ? answers : undefined,
    };

    onCartChange([...cart.filter((item) => item.serviceId !== service.id), nextItem]);
    setFormErrors((current) => {
      const next = { ...current };
      delete next[service.id];
      return next;
    });
  }

  function toggleConfig(serviceId: string) {
    setExpandedConfig((current) => ({ ...current, [serviceId]: !current[serviceId] }));
  }

  return (
    <section className={styles.step}>
      <div className={styles.stepHeader}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← Retour
        </button>
        <div>
          <h2 className={styles.title}>Services additionnels</h2>
          <p className={styles.lead}>Complétez votre réservation avec les services disponibles.</p>
        </div>
      </div>

      {loading ? <p className={styles.loading}>Chargement des services…</p> : null}

      <div
        className={[styles.serviceGrid, services.length === 1 ? styles.serviceGridSingle : ""]
          .filter(Boolean)
          .join(" ")}
      >
        {services.map((service) => {
          const cartItem = cartByServiceId.get(service.id);
          const qty = cartItem?.qty ?? 0;
          const hasQuestions = service.customQuestions.length > 0;
          const isConfigOpen = Boolean(expandedConfig[service.id]);

          return (
            <article key={service.id} className={styles.serviceCard}>
              <div className={styles.serviceCardMain}>
                <div className={styles.serviceMedia}>
                  {service.photo?.url ? (
                    <Image
                      src={service.photo.url}
                      alt={service.photo.alt ?? service.label}
                      fill
                      sizes={BOOKING_SERVICE_CARD_IMAGE_SIZES}
                      className={styles.serviceImage}
                    />
                  ) : (
                    <div className={styles.serviceFallback}>Service</div>
                  )}
                </div>

                <div className={styles.serviceInfo}>
                  <h3 className={styles.serviceName}>{service.label}</h3>
                  {service.description ? (
                    <p className={styles.serviceDescription}>{service.description}</p>
                  ) : null}
                  <p className={styles.servicePrice}>
                    {formatCentsAsEuroString(service.priceHTCents)} € HT · TVA {service.vatRate} %
                  </p>
                </div>

                <div className={styles.serviceQtyWrap}>
                  <span className={styles.qtyLabel}>Qté</span>
                  <QuantityStepper
                    value={qty}
                    min={0}
                    onChange={(next) => updateQty(service, next)}
                    aria-label={`Quantité ${service.label}`}
                    decreaseLabel="Diminuer la quantité"
                    increaseLabel="Augmenter la quantité"
                  />
                </div>
              </div>

              {qty > 0 && hasQuestions ? (
                <div className={styles.serviceConfig}>
                  <button
                    type="button"
                    className={styles.configToggle}
                    aria-expanded={isConfigOpen}
                    onClick={() => toggleConfig(service.id)}
                  >
                    {isConfigOpen ? "Masquer la configuration" : "Configurer"}
                  </button>
                  {isConfigOpen ? (
                    <BookingCustomQuestionsForm
                      questions={service.customQuestions}
                      values={draftAnswers[service.id] ?? {}}
                      errors={formErrors[service.id]}
                      onChange={(questionId, value) =>
                        setDraftAnswers((current) => ({
                          ...current,
                          [service.id]: {
                            ...(current[service.id] ?? {}),
                            [questionId]: value,
                          },
                        }))
                      }
                    />
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
