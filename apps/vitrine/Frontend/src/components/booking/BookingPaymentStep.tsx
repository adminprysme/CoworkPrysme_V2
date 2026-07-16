"use client";

import type { BookingPaymentMethod } from "@coworkprysme/shared";
import { useEffect, useState } from "react";

import { fetchBookingPaymentMethods } from "@/lib/booking-confirm-api";

import styles from "./BookingTunnelStep.module.css";

interface BookingPaymentStepProps {
  startAt: string;
  onBack: () => void;
  onConfirm: (paymentMethod: BookingPaymentMethod) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function BookingPaymentStep({
  startAt,
  onBack,
  onConfirm,
  loading,
  error,
}: BookingPaymentStepProps) {
  const [paymentMethod, setPaymentMethod] = useState<BookingPaymentMethod>("proforma");
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
          current === "bank_transfer" && !data.bankTransferAvailable ? "proforma" : current,
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
            La réservation est enregistrée en attente, puis vous saisissez votre carte dans un
            formulaire sécurisé Stripe (Payment Element).
          </p>
        </button>

        {!methodsLoading && bankTransferAvailable ? (
          <button
            type="button"
            role="radio"
            aria-checked={paymentMethod === "bank_transfer"}
            className={[
              styles.paymentOption,
              paymentMethod === "bank_transfer" ? styles.paymentOptionSelected : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setPaymentMethod("bank_transfer")}
          >
            <p className={styles.paymentOptionTitle}>Payer par virement bancaire</p>
            <p className={styles.paymentOptionText}>
              Réservation enregistrée en attente. Vous recevez le RIB et le libellé exact à utiliser
              ; le créneau est libéré si le virement n&apos;arrive pas à temps.
            </p>
          </button>
        ) : null}
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
