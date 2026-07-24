"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useMemo, useRef, useState, type FormEvent } from "react";

import styles from "./BookingTunnelStep.module.css";

let stripePromise: Promise<Stripe | null> | null = null;

function getStripePromise(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}

interface BookingCardPaymentFormProps {
  clientSecret: string;
  /** Absolute URL Stripe redirects to after Bancontact / 3DS / etc. */
  returnUrl: string;
  onSubmitted: () => void;
  onError: (message: string) => void;
}

function CardPaymentInner({
  clientSecret,
  returnUrl,
  onSubmitted,
  onError,
}: BookingCardPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  /** Sync guard — React state alone cannot block double-click / Enter spam before re-render. */
  const inFlightRef = useRef(false);

  async function paymentAlreadySucceeded(): Promise<boolean> {
    if (!stripe || !clientSecret) return false;
    try {
      const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
      return paymentIntent?.status === "succeeded";
    } catch {
      return false;
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    if (inFlightRef.current || submitting) {
      return;
    }

    if (!returnUrl.trim()) {
      onError("URL de retour paiement manquante — impossible de confirmer.");
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);
    onError("");

    try {
      // Missed client response after a prior success: treat as done, do not confirm again.
      if (await paymentAlreadySucceeded()) {
        onSubmitted();
        return;
      }

      const result = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: {
          // Required whenever automatic_payment_methods may include redirect methods.
          return_url: returnUrl,
        },
      });

      // If Stripe redirected, this code path does not run — the return page resumes via query params.

      if (result.error) {
        // Confirm can 400 when PI already succeeded (race / double-submit / missed response).
        if (await paymentAlreadySucceeded()) {
          onSubmitted();
          return;
        }
        inFlightRef.current = false;
        setSubmitting(false);
        onError(result.error.message ?? "Le paiement a échoué. Vous pouvez réessayer.");
        return;
      }

      // Keep submitting=true until parent reaches a terminal view — one confirm only.
      onSubmitted();
    } catch (error: unknown) {
      if (await paymentAlreadySucceeded()) {
        onSubmitted();
        return;
      }
      inFlightRef.current = false;
      setSubmitting(false);
      onError(
        error instanceof Error ? error.message : "Le paiement a échoué. Vous pouvez réessayer.",
      );
    }
  }

  return (
    <form className={styles.cardPaymentForm} onSubmit={(event) => void handleSubmit(event)}>
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />
      {submitting ? (
        <div className={styles.paymentProcessing} role="status" aria-live="polite">
          <span className={styles.paymentSpinner} aria-hidden />
          <p className={styles.paymentProcessingText}>Traitement du paiement en cours…</p>
        </div>
      ) : null}
      <button type="submit" className={styles.primaryButton} disabled={!stripe || submitting}>
        {submitting ? "Traitement…" : "Payer maintenant"}
      </button>
    </form>
  );
}

export function BookingCardPaymentForm({
  clientSecret,
  returnUrl,
  onSubmitted,
  onError,
}: BookingCardPaymentFormProps) {
  const options = useMemo(
    () => ({
      clientSecret,
      appearance: {
        theme: "stripe" as const,
        variables: {
          colorPrimary: "#c58369",
          colorBackground: "#ffffff",
          colorText: "#2a2522",
          borderRadius: "8px",
        },
      },
    }),
    [clientSecret],
  );

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()) {
    return (
      <p className={styles.error}>
        Paiement par carte indisponible (clé publique Stripe manquante).
      </p>
    );
  }

  return (
    <Elements stripe={getStripePromise()} options={options}>
      <CardPaymentInner
        clientSecret={clientSecret}
        returnUrl={returnUrl}
        onSubmitted={onSubmitted}
        onError={onError}
      />
    </Elements>
  );
}
