"use client";

import type { BookingPaymentMethod } from "@coworkprysme/shared";
import { useEffect, useState, type ReactNode } from "react";

import { fetchBookingPaymentMethods } from "@/lib/booking-confirm-api";

import styles from "./BookingTunnelStep.module.css";

interface BookingPaymentStepProps {
  startAt: string;
  onBack: () => void;
  onConfirm: (paymentMethod: BookingPaymentMethod) => Promise<void>;
  loading: boolean;
  error: string | null;
}

type PaymentOptionConfig = {
  method: BookingPaymentMethod;
  title: string;
  description: string;
  icon: ReactNode;
};

function IconCard() {
  return (
    <svg className={styles.paymentOptionIconSvg} viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="2.5"
        y="5"
        width="19"
        height="14"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M2.5 9.5h19" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 15h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconTransfer() {
  return (
    <svg className={styles.paymentOptionIconSvg} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 7h12M12 4l4 3-4 3M20 17H8M12 14l-4 3 4 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDeferred() {
  return (
    <svg className={styles.paymentOptionIconSvg} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 8v4.5l3 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const BASE_OPTIONS: PaymentOptionConfig[] = [
  {
    method: "card",
    title: "Carte bancaire",
    description: "Réglez immédiatement par carte bancaire, en toute sécurité.",
    icon: <IconCard />,
  },
  {
    method: "bank_transfer",
    title: "Virement bancaire",
    description: "Recevez nos coordonnées bancaires par email et réglez par virement.",
    icon: <IconTransfer />,
  },
  {
    method: "proforma",
    title: "Paiement différé",
    description: "Confirmez votre réservation maintenant et réglez plus tard.",
    icon: <IconDeferred />,
  },
];

export function BookingPaymentStep({
  startAt,
  onBack,
  onConfirm,
  loading,
  error,
}: BookingPaymentStepProps) {
  const [paymentMethod, setPaymentMethod] = useState<BookingPaymentMethod>("card");
  const [bankTransferAvailable, setBankTransferAvailable] = useState(false);
  const [methodsLoading, setMethodsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setMethodsLoading(true);
    void fetchBookingPaymentMethods(startAt)
      .then((data) => {
        if (cancelled) {
          return;
        }
        setBankTransferAvailable(data.bankTransferAvailable);
        setPaymentMethod((current) =>
          current === "bank_transfer" && !data.bankTransferAvailable ? "card" : current,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setBankTransferAvailable(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMethodsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [startAt]);

  const visibleOptions = BASE_OPTIONS.filter(
    (option) => option.method !== "bank_transfer" || (!methodsLoading && bankTransferAvailable),
  );

  return (
    <section className={styles.step}>
      <div className={styles.stepHeader}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← Retour
        </button>
        <div>
          <h2 className={styles.title}>Règlement</h2>
          <p className={styles.lead}>Choisissez votre mode de règlement.</p>
        </div>
      </div>

      <div className={styles.paymentOptions} role="radiogroup" aria-label="Mode de règlement">
        {visibleOptions.map((option) => {
          const selected = paymentMethod === option.method;
          return (
            <button
              key={option.method}
              type="button"
              role="radio"
              aria-checked={selected}
              className={[styles.paymentOption, selected ? styles.paymentOptionSelected : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setPaymentMethod(option.method)}
            >
              <span className={styles.paymentOptionIcon} aria-hidden="true">
                {option.icon}
              </span>
              <span className={styles.paymentOptionBody}>
                <span className={styles.paymentOptionTitle}>{option.title}</span>
                <span className={styles.paymentOptionText}>{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={loading || methodsLoading}
          onClick={() => void onConfirm(paymentMethod)}
        >
          {loading ? "Confirmation…" : "Valider ma réservation"}
        </button>
      </div>
    </section>
  );
}
