"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BookingCardPaymentForm } from "@/components/booking/BookingCardPaymentForm";
import { Container } from "@/components/ui/Container";
import {
  createQuotePaymentIntent,
  fetchQuotePaymentPreview,
  fetchQuotePaymentStatus,
  QuotePaymentApiError,
} from "@/lib/quote-payment-api";
import type { QuotePaymentLinkPreview } from "@coworkprysme/shared";

import styles from "./QuotePayPageContent.module.css";

type PageStatus =
  "loading" | "ready" | "paying" | "success" | "expired" | "consumed" | "not_found" | "error";

function statusFromApiCode(code: string): PageStatus | null {
  switch (code) {
    case "PAYMENT_LINK_EXPIRED":
      return "expired";
    case "PAYMENT_LINK_CONSUMED":
      return "consumed";
    case "PAYMENT_LINK_REVOKED":
    case "PAYMENT_LINK_NOT_FOUND":
      return "not_found";
    default:
      return null;
  }
}

function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function QuotePayPageContent() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const invoiceId = useMemo(() => searchParams.get("invoiceId")?.trim() ?? "", [searchParams]);

  const [status, setStatus] = useState<PageStatus>("loading");
  const [preview, setPreview] = useState<QuotePaymentLinkPreview | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [awaitingWebhook, setAwaitingWebhook] = useState(false);

  const viewStatus: PageStatus = !token || !invoiceId ? "not_found" : status;

  useEffect(() => {
    if (!token || !invoiceId) {
      setStatus("not_found");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setPreview(null);
    setFormError(null);

    void fetchQuotePaymentPreview(token, invoiceId)
      .then((payload) => {
        if (cancelled) return;
        setPreview(payload);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof QuotePaymentApiError) {
          const mapped = statusFromApiCode(error.code);
          setStatus(mapped ?? "error");
          return;
        }
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token, invoiceId]);

  async function startPayment() {
    if (!token || !invoiceId) return;
    setIntentLoading(true);
    setFormError(null);
    try {
      const intent = await createQuotePaymentIntent(token, invoiceId);
      setClientSecret(intent.clientSecret);
      setStatus("paying");
    } catch (error: unknown) {
      if (error instanceof QuotePaymentApiError) {
        const mapped = statusFromApiCode(error.code);
        if (mapped) {
          setStatus(mapped);
          return;
        }
        setFormError(error.message);
        return;
      }
      setFormError("Impossible de démarrer le paiement.");
    } finally {
      setIntentLoading(false);
    }
  }

  async function pollUntilPaid() {
    if (!token || !invoiceId) return;
    setAwaitingWebhook(true);
    setFormError(null);
    for (let i = 0; i < 12; i += 1) {
      try {
        const st = await fetchQuotePaymentStatus(token, invoiceId);
        if (
          st.paymentState === "paid" ||
          st.paymentState === "partially_paid" ||
          st.linkStatus === "consumed"
        ) {
          setAwaitingWebhook(false);
          setStatus("success");
          return;
        }
      } catch {
        // keep polling
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    // Card confirm already succeeded; webhook may still be lagging locally.
    setAwaitingWebhook(false);
    setStatus("success");
  }

  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/payer-devis?token=${encodeURIComponent(token)}&invoiceId=${encodeURIComponent(invoiceId)}&paid=1`
      : "";

  return (
    <Container>
      <div className={styles.wrap}>
        <h1 className={styles.title}>Payer votre devis</h1>

        {viewStatus === "loading" ? <p className={styles.muted}>Chargement…</p> : null}

        {viewStatus === "not_found" ? (
          <p className={styles.error}>Ce lien de paiement est introuvable ou invalide.</p>
        ) : null}

        {viewStatus === "expired" ? (
          <p className={styles.error}>Ce lien de paiement a expiré.</p>
        ) : null}

        {viewStatus === "consumed" ? (
          <p className={styles.success}>Ce paiement a déjà été effectué. Merci.</p>
        ) : null}

        {viewStatus === "error" ? (
          <p className={styles.error}>Une erreur est survenue. Réessayez plus tard.</p>
        ) : null}

        {viewStatus === "success" ? (
          <p className={styles.success}>
            Paiement bien reçu. Vous recevrez une confirmation par email.
          </p>
        ) : null}

        {(viewStatus === "ready" || viewStatus === "paying") && preview ? (
          <div className={styles.card}>
            <p>
              Devis <strong>{preview.quoteReference}</strong>
              {preview.isDeposit ? " — acompte" : ""}
            </p>
            <p className={styles.amount}>{formatEuro(preview.amountDueCents)}</p>
            <p className={styles.muted}>
              Facture {preview.invoiceReference} · valable jusqu&apos;au{" "}
              {new Date(preview.expiresAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
            </p>

            {viewStatus === "ready" ? (
              <button
                type="button"
                className={styles.primary}
                disabled={intentLoading}
                onClick={() => void startPayment()}
              >
                {intentLoading ? "Préparation…" : "Payer par carte"}
              </button>
            ) : null}

            {viewStatus === "paying" && clientSecret ? (
              <div className={styles.elements}>
                {awaitingWebhook ? (
                  <div className={styles.processing} role="status" aria-live="polite">
                    <span className={styles.spinner} aria-hidden />
                    <p>Traitement du paiement en cours…</p>
                  </div>
                ) : (
                  <BookingCardPaymentForm
                    clientSecret={clientSecret}
                    returnUrl={returnUrl}
                    onSubmitted={() => void pollUntilPaid()}
                    onError={(message) => setFormError(message)}
                  />
                )}
              </div>
            ) : null}

            {formError ? <p className={styles.error}>{formError}</p> : null}
          </div>
        ) : null}
      </div>
    </Container>
  );
}
