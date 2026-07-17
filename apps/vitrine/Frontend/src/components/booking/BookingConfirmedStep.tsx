"use client";

import type {
  BookingConfirmResponse,
  BookingPaymentState,
  BookingPaymentStatusResponse,
} from "@coworkprysme/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { createBookingPaymentIntent, fetchBookingPaymentStatus } from "@/lib/booking-payment-api";
import {
  buildBookingPaymentReturnUrl,
  clearBookingPaymentResumeSnapshot,
  saveBookingPaymentResumeSnapshot,
} from "@/lib/booking-payment-return";

import { BookingCardPaymentForm } from "./BookingCardPaymentForm";
import styles from "./BookingTunnelStep.module.css";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 60_000;

interface BookingConfirmedStepProps {
  result: BookingConfirmResponse;
  spaceLabel: string;
  slotLabel: string;
  /**
   * Client landed here after a Stripe redirect (Bancontact / 3DS / etc.).
   * Start polling webhook status — do not trust redirect_status as paid.
   */
  resumeAfterRedirect?: boolean;
  /** Stripe redirect_status from the return URL (informational only). */
  stripeRedirectStatus?: string | null;
}

function formatEuroFromCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

export function BookingConfirmedStep({
  result,
  spaceLabel,
  slotLabel,
  resumeAfterRedirect = false,
  stripeRedirectStatus = null,
}: BookingConfirmedStepProps) {
  const isCard = result.paymentMethod === "card";
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentLoading, setIntentLoading] = useState(isCard && !resumeAfterRedirect);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentState, setPaymentState] = useState<BookingPaymentState>(() => {
    if (!isCard) {
      return "paid";
    }
    // After redirect: poll only — webhook decides paid vs still awaiting.
    return resumeAfterRedirect ? "confirming" : "awaiting_payment";
  });
  const [reservationStatus, setReservationStatus] = useState(result.reservationStatus);
  const [paidTotal, setPaidTotal] = useState(0);
  const [balanceDue, setBalanceDue] = useState<number | null>(null);

  const returnUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return buildBookingPaymentReturnUrl({
      origin: window.location.origin,
      reservationReference: result.reservationReference,
      invoiceReference: result.invoiceReference,
    });
  }, [result.invoiceReference, result.reservationReference]);

  const persistResumeSnapshot = useCallback(() => {
    saveBookingPaymentResumeSnapshot({
      version: 1,
      reservationReference: result.reservationReference,
      invoiceReference: result.invoiceReference,
      reservationStatus: result.reservationStatus,
      spaceLabel,
      slotLabel,
    });
  }, [
    result.invoiceReference,
    result.reservationReference,
    result.reservationStatus,
    slotLabel,
    spaceLabel,
  ]);

  const applyStatus = useCallback((status: BookingPaymentStatusResponse) => {
    setPaidTotal(status.paidTotal);
    setBalanceDue(status.balanceDue);
    setReservationStatus(status.reservationStatus);
    if (status.paymentState === "paid" || status.paymentState === "partially_paid") {
      setPaymentState(status.paymentState);
      clearBookingPaymentResumeSnapshot();
    }
  }, []);

  const loadIntent = useCallback(async () => {
    setIntentLoading(true);
    setIntentError(null);
    try {
      persistResumeSnapshot();
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
  }, [persistResumeSnapshot, result.invoiceReference, result.reservationReference]);

  useEffect(() => {
    if (!isCard) {
      return;
    }
    if (resumeAfterRedirect) {
      // Snapshot already useful for labels; keep it until webhook confirms.
      persistResumeSnapshot();
      return;
    }
    void loadIntent();
  }, [isCard, loadIntent, persistResumeSnapshot, resumeAfterRedirect]);

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
        applyStatus(status);
        if (
          status.reservationStatus === "confirmed" &&
          (status.paymentState === "paid" || status.paymentState === "partially_paid")
        ) {
          return;
        }
        // Still awaiting after redirect: offer retry once poll window ends or immediately if redirect failed.
        if (
          resumeAfterRedirect &&
          stripeRedirectStatus === "failed" &&
          status.paymentState === "awaiting_payment"
        ) {
          setPaymentState("failed");
          setPaymentError(
            "Le paiement n'a pas abouti après la redirection. Vous pouvez réessayer.",
          );
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
  }, [
    applyStatus,
    isCard,
    paymentState,
    result.invoiceReference,
    result.reservationReference,
    resumeAfterRedirect,
    stripeRedirectStatus,
  ]);

  const paymentSettled =
    isCard &&
    reservationStatus === "confirmed" &&
    (paymentState === "paid" || paymentState === "partially_paid");
  const paymentPending =
    isCard &&
    reservationStatus === "awaiting_payment" &&
    (paymentState === "awaiting_payment" ||
      paymentState === "failed" ||
      paymentState === "confirming");

  // --- Proforma: definitive confirmation ---
  if (result.paymentMethod === "proforma") {
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
            reservationStatus={reservationStatus}
          />
          <p className={styles.lead}>
            Un email de confirmation vous a été envoyé avec le détail et le plan d&apos;accès.
          </p>
        </div>
      </section>
    );
  }

  // --- Bank transfer: hold + RIB instructions ---
  if (result.paymentMethod === "bank_transfer") {
    const bt = result.bankTransfer;
    const expiresLabel = bt?.expiresAt
      ? new Date(bt.expiresAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
      : null;
    return (
      <section className={styles.step}>
        <div className={styles.confirmedCard}>
          <h2 className={styles.title}>Réservation enregistrée — virement à effectuer</h2>
          <p className={styles.lead}>
            Votre réservation <strong>{result.reservationReference}</strong> est enregistrée en
            attente de paiement. Effectuez un virement avec le libellé exact ci-dessous.
          </p>
          <BookingRecap
            spaceLabel={spaceLabel}
            slotLabel={slotLabel}
            invoiceReference={result.invoiceReference}
            reservationStatus={reservationStatus}
          />
          {bt ? (
            <div className={styles.bankTransferBlock} aria-label="Instructions de virement">
              <p className={styles.lineRow}>
                <span>Montant exact</span>
                <span>{formatEuroFromCents(bt.amountCents)}</span>
              </p>
              <p className={styles.bankTransferLabelTitle}>Libellé du virement</p>
              <p className={styles.bankTransferLabel}>{bt.transferLabel}</p>
              <p className={styles.lineRow}>
                <span>Titulaire</span>
                <span>{bt.accountHolder}</span>
              </p>
              {bt.bankName ? (
                <p className={styles.lineRow}>
                  <span>Banque</span>
                  <span>{bt.bankName}</span>
                </p>
              ) : null}
              <p className={styles.lineRow}>
                <span>IBAN</span>
                <span className={styles.mono}>{bt.iban}</span>
              </p>
              <p className={styles.lineRow}>
                <span>BIC</span>
                <span className={styles.mono}>{bt.bic}</span>
              </p>
              {expiresLabel ? (
                <p className={styles.notice}>
                  À régler avant le <strong>{expiresLabel}</strong>. Passé ce délai, la réservation
                  pourra être annulée automatiquement.
                </p>
              ) : null}
            </div>
          ) : (
            <p className={styles.notice}>
              Les instructions de virement vous ont été envoyées par email.
            </p>
          )}
          <p className={styles.lead}>
            Un email avec le RIB et le libellé exact vous a également été envoyé.
          </p>
        </div>
      </section>
    );
  }

  // --- Card: paid (webhook confirmed) — status must be confirmed in DB ---
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
            reservationStatus={reservationStatus}
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

  // --- Card: awaiting_payment in DB — reservation held, payment still required ---
  return (
    <section className={styles.step}>
      <div className={styles.confirmedCard}>
        <h2 className={styles.title}>
          {resumeAfterRedirect && paymentState === "confirming"
            ? "Retour du paiement"
            : "Réservation enregistrée"}
        </h2>
        <p className={styles.lead}>
          {resumeAfterRedirect && paymentState === "confirming" ? (
            <>
              Vous êtes de retour après l&apos;étape de paiement sécurisée. Nous confirmons votre
              réservation <strong>{result.reservationReference}</strong> auprès de notre serveur (le
              webhook Stripe fait foi)…
            </>
          ) : (
            <>
              Votre réservation <strong>{result.reservationReference}</strong> est bien enregistrée
              {reservationStatus === "awaiting_payment" ? " (en attente de paiement)" : ""}.
              Complétez votre paiement ci-dessous pour finaliser votre réservation.
            </>
          )}
        </p>
        <BookingRecap
          spaceLabel={spaceLabel}
          slotLabel={slotLabel}
          invoiceReference={result.invoiceReference}
          reservationStatus={reservationStatus}
        />

        {paymentPending ? (
          <div className={styles.cardPaymentActive} aria-labelledby="card-payment-step-title">
            <h3 id="card-payment-step-title" className={styles.cardPaymentActiveTitle}>
              {paymentState === "confirming"
                ? "Confirmation du paiement"
                : "Étape suivante — paiement par carte"}
            </h3>
            {paymentState !== "confirming" ? (
              <p className={styles.cardPaymentActiveLead}>
                Saisissez vos informations de carte pour finaliser le paiement sécurisé. Aucune
                donnée de carte ne transite par nos serveurs.
              </p>
            ) : null}

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
                {clientSecret && !intentLoading && returnUrl ? (
                  <BookingCardPaymentForm
                    clientSecret={clientSecret}
                    returnUrl={returnUrl}
                    onSubmitted={() => {
                      persistResumeSnapshot();
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

        {reservationStatus === "cancelled" ? (
          <p className={styles.error} role="alert">
            Le délai de paiement est dépassé — cette réservation a été annulée. Relancez une
            recherche pour réserver un créneau.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function BookingRecap({
  spaceLabel,
  slotLabel,
  invoiceReference,
  reservationStatus,
}: {
  spaceLabel: string;
  slotLabel: string;
  invoiceReference: string;
  reservationStatus: BookingConfirmResponse["reservationStatus"];
}) {
  const statusLabel =
    reservationStatus === "awaiting_payment"
      ? "En attente de paiement"
      : reservationStatus === "confirmed"
        ? "Confirmée"
        : reservationStatus === "cancelled"
          ? "Annulée"
          : reservationStatus;

  return (
    <>
      {spaceLabel ? (
        <p className={styles.lineRow}>
          <span>{spaceLabel}</span>
        </p>
      ) : null}
      {slotLabel ? (
        <p className={styles.lineRow}>
          <span>{slotLabel}</span>
        </p>
      ) : null}
      <p className={styles.lineRow}>
        <span>Statut</span>
        <span>{statusLabel}</span>
      </p>
      <p className={styles.lineRow}>
        <span>Facture proforma</span>
        <span>{invoiceReference}</span>
      </p>
    </>
  );
}
