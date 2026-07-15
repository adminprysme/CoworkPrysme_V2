"use client";

import type { BookingServiceCatalogItem, ServiceCustomAnswer } from "@coworkprysme/shared";
import { formatCentsAsEuroString } from "@coworkprysme/shared";
import Image from "next/image";
import { useMemo, useState } from "react";

import {
  BookingCustomQuestionsForm,
  buildCustomAnswersFromForm,
  validateCustomQuestionForm,
} from "./BookingCustomQuestionsForm";
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
  discountCode: string;
  promoMessage: string | null;
  promoError: string | null;
  onCartChange: (cart: BookingCartItem[]) => void;
  onDiscountCodeChange: (code: string) => void;
  onBack: () => void;
}

export function BookingServicesStep({
  services,
  cart,
  loading,
  discountCode,
  promoMessage,
  promoError,
  onCartChange,
  onDiscountCodeChange,
  onBack,
}: BookingServicesStepProps) {
  const [draftAnswers, setDraftAnswers] = useState<Record<string, Record<string, unknown>>>({});
  const [formErrors, setFormErrors] = useState<Record<string, Record<string, string>>>({});

  const cartByServiceId = useMemo(
    () => new Map(cart.map((item) => [item.serviceId, item])),
    [cart],
  );

  function updateQty(service: BookingServiceCatalogItem, qty: number) {
    if (qty <= 0) {
      onCartChange(cart.filter((item) => item.serviceId !== service.id));
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

      <div className={styles.serviceGrid}>
        {services.map((service) => {
          const cartItem = cartByServiceId.get(service.id);
          const qty = cartItem?.qty ?? 0;

          return (
            <article key={service.id} className={styles.serviceCard}>
              <div className={styles.serviceTop}>
                <div className={styles.serviceMedia}>
                  {service.photo?.url ? (
                    <Image
                      src={service.photo.url}
                      alt={service.photo.alt ?? service.label}
                      fill
                      sizes="6rem"
                      className={styles.serviceImage}
                    />
                  ) : (
                    <div className={styles.serviceFallback}>Service</div>
                  )}
                </div>
                <div>
                  <h3 className={styles.serviceName}>{service.label}</h3>
                  {service.description ? (
                    <p className={styles.serviceDescription}>{service.description}</p>
                  ) : null}
                  <p className={styles.servicePrice}>
                    {formatCentsAsEuroString(service.priceHTCents)} € HT · TVA {service.vatRate} %
                  </p>
                </div>
              </div>

              <label className={styles.qtyField}>
                <span>Quantité</span>
                <input
                  className={styles.qtyInput}
                  type="number"
                  min={0}
                  value={qty}
                  onChange={(event) => updateQty(service, Number(event.target.value))}
                />
              </label>

              {qty > 0 && service.customQuestions.length > 0 ? (
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
            </article>
          );
        })}
      </div>

      <div className={styles.promoBlock}>
        <label className={styles.promoField}>
          <span>Code promo ou préférentiel</span>
          <input
            className={styles.promoInput}
            type="text"
            value={discountCode}
            placeholder="Ex. WELCOME20"
            onChange={(event) => onDiscountCodeChange(event.target.value.toUpperCase())}
          />
        </label>
        {promoMessage ? <p className={styles.promoInfo}>{promoMessage}</p> : null}
        {promoError ? <p className={styles.promoError}>{promoError}</p> : null}
      </div>
    </section>
  );
}
