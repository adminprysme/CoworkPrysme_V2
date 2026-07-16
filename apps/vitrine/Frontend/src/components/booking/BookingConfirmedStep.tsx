"use client";

import type { BookingConfirmResponse, BookingPaymentState } from "@coworkprysme/shared";
import { useCallback, useEffect, useState } from "react";

import { createBookingPaymentIntent, fetchBookingPaymentStatus } from "@/lib/booking-payment-api";

import { BookingCardPaymentForm } from "./BookingCardPaymentForm";
import styles from "./BookingTunnelStep.module.css";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 60_000;

interface BookingConfirmedStepProps {
  result: BookingConfirmResponse;
  spaceLabel: string;
  slotLabel: string;
}

function formatEuroFromCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

export function BookingConfirmedStep({ result, spaceLabel, slotLabel }: BookingConfirmedStepProps) {
  const isCard = result.paymentMethod === "card";
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentLoading, setIntentLoading] = useState(isCard);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentState, setPaymentState] = useState<BookingPaymentState>(
    isCard ? "awaiting_payment" : "paid",
  );
  const [paidTotal, setPaidTotal] = useState(0);
  const [balanceDue, setBalanceDue] = useState<number | null>(null);

  const loadIntent = useCallback(async () => {
    setIntentLoading(true);
    setIntentError(null);
    try {
      const intent = await createBookingPaymentIntent({
        reservationReference: result.reservationReference,
        invoiceReference: result.invoiceReference,
      });
      setClientSecret(intent.clientSecret);
      setPaymentState("awaiting_payment");
    } catch (error: unknown) {
      setIntentError(
        error instanceof Error ? error.message : "Impossible d'initialiser le paiement carte",
      );
    } finally {
      setIntentLoading(false);
    }
  }, [result.invoiceReference, result.reservationReference]);

  useEffect(() => {
    if (!isCard) {
      return;
    }
    void loadIntent();
  }, [isCard, loadIntent]);

  useEffect(() => {
    if (!isCard || paymentState !== "confirming") {
      return;
    }

    const startedAt = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      if (cancelled) {
        return;
      }
      try {
        const status = await fetchBookingPaymentStatus({
          reservationReference: result.reservationReference,
          invoiceReference: result.invoiceReference,
        });
        if (cancelled) {
          return;
        }
        setPaidTotal(status.paidTotal);
        setBalanceDue(status.balanceDue);
        if (status.paymentState === "paid" || status.paymentState === "partially_paid") {
          setPaymentState(status.paymentState);
          return;
        }
      } catch {
        // Keep polling until timeout — webhook may still land.
      }

      if (Date.now() - startedAt >= POLL_MAX_MS) {
        setPaymentState("failed");
        setPaymentError(
          "La confirmation du paiement prend plus de temps que prévu. Votre réservation est enregistrée — vérifiez votre email ou réessayez.",
        );
        return;
      }

      timer = setTimeout(() => {
        void poll();
      }, POLL_INTERVAL_MS);
    }

    void poll();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [isCard, paymentState, result.invoiceReference, result.reservationReference]);

  const paymentSettled = isCard && (paymentState === "paid" || paymentState === "partially_paid");
  const paymentPending =
    isCard &&
    (paymentState === "awaiting_payment" ||
      paymentState === "failed" ||
      paymentState === "confirming");

  // --- Proforma: definitive confirmation (unchanged intent) ---
  if (!isCard) {
    return (
      <section className={styles.step}>
        <div className={styles.confirmedCard}>
          <h2 className={styles.title}>Réservation confirmée</h2>
          <p className={styles.lead}>
            Merci — votre réservation <strong>{result.reservationReference}</strong> est
            enregistrée.
          </p>
          <BookingRecap
            spaceLabel={spaceLabel}
            slotLabel={slotLabel}
            invoiceReference={result.invoiceReference}
          />
          <p className={styles.lead}>
            Un email de confirmation vous a été envoyé avec le détail et le plan d&apos;accès.
          </p>
        </div>
      </section>
    );
  }

  // --- Card: paid (webhook confirmed) ---
  if (paymentSettled) {
    return (
      <section className={styles.step}>
        <div className={styles.confirmedCard}>
          <h2 className={styles.title}>
            {paymentState === "paid"
              ? "Réservation confirmée et payée"
              : "Réservation confirmée — paiement partiel"}
          </h2>
          <p className={styles.lead}>
            Merci — votre réservation <strong>{result.reservationReference}</strong> est enregistrée
            {paymentState === "paid" ? " et votre paiement a été confirmé." : "."}
          </p>
          <BookingRecap
            spaceLabel={spaceLabel}
            slotLabel={slotLabel}
            invoiceReference={result.invoiceReference}
          />
          <p className={styles.successNotice}>
            {paymentState === "paid" ? "Paiement confirmé. Merci !" : "Paiement partiel confirmé."}
          </p>
          {paidTotal > 0 ? (
            <p className={styles.lineRow}>
              <span>Déjà réglé</span>
              <span>{formatEuroFromCents(paidTotal)}</span>
            </p>
          ) : null}
          {balanceDue !== null && balanceDue > 0 ? (
            <p className={styles.lineRow}>
              <span>Solde restant</span>
              <span>{formatEuroFromCents(balanceDue)}</span>
            </p>
          ) : null}
          <p className={styles.lead}>
            Un email de confirmation vous a été envoyé avec le détail et le plan d&apos;accès.
          </p>
        </div>
      </section>
    );
  }

  // --- Card: awaiting / confirming / failed — reservation saved, payment still required ---
  return (
    <section className={styles.step}>
      <div className={styles.confirmedCard}>
        <h2 className={styles.title}>Réservation enregistrée</h2>
        <p className={styles.lead}>
          Votre réservation <strong>{result.reservationReference}</strong> est bien enregistrée.
          Complétez votre paiement ci-dessous pour finaliser votre réservation.
        </p>
        <BookingRecap
          spaceLabel={spaceLabel}
          slotLabel={slotLabel}
          invoiceReference={result.invoiceReference}
        />

        {paymentPending ? (
          <div className={styles.cardPaymentActive} aria-labelledby="card-payment-step-title">
            <h3 id="card-payment-step-title" className={styles.cardPaymentActiveTitle}>
              Étape suivante — paiement par carte
            </h3>
            <p className={styles.cardPaymentActiveLead}>
              Saisissez vos informations de carte pour régler la facture proforma. Le montant est
              calculé côté serveur ; aucune donnée de carte ne transite par nos serveurs.
            </p>

            {paymentState === "confirming" ? (
              <p className={styles.notice} role="status">
                Paiement en cours de confirmation… Ne fermez pas cette page.
              </p>
            ) : null}

            {(paymentState === "awaiting_payment" || paymentState === "failed") && (
              <>
                {intentLoading ? <p className={styles.notice}>Préparation du paiement…</p> : null}
                {intentError ? <p className={styles.error}>{intentError}</p> : null}
                {paymentError ? <p className={styles.error}>{paymentError}</p> : null}
                {clientSecret && !intentLoading ? (
                  <BookingCardPaymentForm
                    clientSecret={clientSecret}
                    onSubmitted={() => {
                      setPaymentError(null);
                      setPaymentState("confirming");
                    }}
                    onError={(message) => {
                      setPaymentError(message || null);
                      setPaymentState("failed");
                    }}
                  />
                ) : null}
                {paymentState === "failed" ? (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      setPaymentError(null);
                      setClientSecret(null);
                      void loadIntent();
                    }}
                  >
                    Réessayer le paiement
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function BookingRecap({
  spaceLabel,
  slotLabel,
  invoiceReference,
}: {
  spaceLabel: string;
  slotLabel: string;
  invoiceReference: string;
}) {
  return (
    <>
      <p className={styles.lineRow}>
        <span>{spaceLabel}</span>
      </p>
      <p className={styles.lineRow}>
        <span>{slotLabel}</span>
      </p>
      <p className={styles.lineRow}>
        <span>Facture proforma</span>
        <span>{invoiceReference}</span>
      </p>
    </>
  );
}
