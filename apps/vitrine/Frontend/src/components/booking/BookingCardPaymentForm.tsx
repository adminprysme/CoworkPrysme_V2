"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useMemo, useState, type FormEvent } from "react";

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
  returnUrl,
  onSubmitted,
  onError,
}: Omit<BookingCardPaymentFormProps, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    if (!returnUrl.trim()) {
      onError("URL de retour paiement manquante — impossible de confirmer.");
      return;
    }

    setSubmitting(true);
    onError("");

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        // Required whenever automatic_payment_methods may include redirect methods.
        return_url: returnUrl,
      },
    });

    // If Stripe redirected, this code path does not run — the return page resumes via query params.
    setSubmitting(false);

    if (result.error) {
      onError(result.error.message ?? "Le paiement a échoué. Vous pouvez réessayer.");
      return;
    }

    // Never treat browser success as paid — webhook is source of truth.
    onSubmitted();
  }

  return (
    <form className={styles.cardPaymentForm} onSubmit={(event) => void handleSubmit(event)}>
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />
      <button type="submit" className={styles.primaryButton} disabled={!stripe || submitting}>
        {submitting ? "Paiement…" : "Payer maintenant"}
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
      <CardPaymentInner returnUrl={returnUrl} onSubmitted={onSubmitted} onError={onError} />
    </Elements>
  );
}
