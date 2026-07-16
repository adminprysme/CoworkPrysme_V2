"use client";

import type { BookingPaymentMethod } from "@coworkprysme/shared";
import { useState } from "react";

import styles from "./BookingTunnelStep.module.css";

interface BookingPaymentStepProps {
  onBack: () => void;
  onConfirm: (paymentMethod: BookingPaymentMethod) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function BookingPaymentStep({ onBack, onConfirm, loading, error }: BookingPaymentStepProps) {
  const [paymentMethod, setPaymentMethod] = useState<BookingPaymentMethod>("proforma");

  return (
    <section className={styles.step}>
      <div className={styles.stepHeader}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← Retour
        </button>
        <div>
          <h2 className={styles.title}>Règlement</h2>
          <p className={styles.lead}>
            Choisissez votre mode de règlement pour confirmer la réservation.
          </p>
        </div>
      </div>

      <div className={styles.paymentOptions} role="radiogroup" aria-label="Mode de règlement">
        <button
          type="button"
          role="radio"
          aria-checked={paymentMethod === "proforma"}
          className={[
            styles.paymentOption,
            paymentMethod === "proforma" ? styles.paymentOptionSelected : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setPaymentMethod("proforma")}
        >
          <p className={styles.paymentOptionTitle}>Recevoir une facture proforma</p>
          <p className={styles.paymentOptionText}>
            Votre réservation sera confirmée et vous recevrez une facture proforma par email.
          </p>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={paymentMethod === "card"}
          className={[
            styles.paymentOption,
            paymentMethod === "card" ? styles.paymentOptionSelected : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setPaymentMethod("card")}
        >
          <p className={styles.paymentOptionTitle}>Payer par carte maintenant</p>
          <p className={styles.paymentOptionText}>
            La réservation est confirmée immédiatement, puis vous saisissez votre carte dans un
            formulaire sécurisé Stripe (Payment Element).
          </p>
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={loading}
          onClick={() => void onConfirm(paymentMethod)}
        >
          {loading ? "Confirmation…" : "Valider ma réservation"}
        </button>
      </div>
    </section>
  );
}
