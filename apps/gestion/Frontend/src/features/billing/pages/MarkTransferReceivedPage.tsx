import { useState, type FormEvent } from "react";

import type { BankTransferPendingLookupResponse } from "@coworkprysme/shared";

import { lookupBankTransfer, markBankTransferReceived } from "../../../lib/billing-api.js";
import styles from "./MarkTransferReceivedPage.module.css";

function formatEuroFromCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

export function MarkTransferReceivedPage() {
  const [reference, setReference] = useState("");
  const [lookup, setLookup] = useState<BankTransferPendingLookupResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleLookup(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setLookup(null);
    try {
      const result = await lookupBankTransfer(reference.trim());
      setLookup(result);
      if (!result.found) {
        setError(result.message ?? "Référence introuvable.");
      } else if (result.message) {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recherche impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkReceived() {
    if (!lookup?.reservationReference) {
      return;
    }
    setMarking(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await markBankTransferReceived({
        reference: lookup.reservationReference,
      });
      setSuccess(
        `Virement encaissé — ${result.reservationReference} confirmée (${formatEuroFromCents(result.amountReceivedCents)}).`,
      );
      setLookup(null);
      setReference("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Encaissement impossible.");
    } finally {
      setMarking(false);
    }
  }

  const canMark =
    lookup?.found === true &&
    lookup.reservationStatus === "awaiting_payment" &&
    lookup.awaitingPaymentMethod === "bank_transfer" &&
    (lookup.amountDueCents ?? 0) > 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Encaisser un virement</h1>
        <p className={styles.lead}>
          Saisissez la référence de réservation (RES-…) ou de facture proforma pour marquer le
          virement comme reçu.
        </p>
      </header>

      <form className={styles.form} onSubmit={(event) => void handleLookup(event)}>
        <label className={styles.label} htmlFor="transfer-ref">
          Référence
        </label>
        <div className={styles.row}>
          <input
            id="transfer-ref"
            className={styles.input}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="RES-2026-00042"
            autoComplete="off"
          />
          <button
            type="submit"
            className={styles.secondaryButton}
            disabled={loading || !reference.trim()}
          >
            {loading ? "Recherche…" : "Rechercher"}
          </button>
        </div>
      </form>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className={styles.success} role="status">
          {success}
        </p>
      ) : null}

      {lookup?.found && lookup.reservationReference ? (
        <section className={styles.preview} aria-label="Aperçu du virement">
          <p className={styles.previewRow}>
            <span>Réservation</span>
            <strong>{lookup.reservationReference}</strong>
          </p>
          <p className={styles.previewRow}>
            <span>Facture</span>
            <strong>{lookup.invoiceReference}</strong>
          </p>
          <p className={styles.previewRow}>
            <span>Statut</span>
            <strong>{lookup.reservationStatus}</strong>
          </p>
          {lookup.spaceName ? (
            <p className={styles.previewRow}>
              <span>Espace</span>
              <strong>{lookup.spaceName}</strong>
            </p>
          ) : null}
          {lookup.clientEmail ? (
            <p className={styles.previewRow}>
              <span>Client</span>
              <strong>{lookup.clientEmail}</strong>
            </p>
          ) : null}
          {typeof lookup.amountDueCents === "number" ? (
            <p className={styles.previewRow}>
              <span>Montant dû</span>
              <strong>{formatEuroFromCents(lookup.amountDueCents)}</strong>
            </p>
          ) : null}

          <button
            type="button"
            className={styles.primaryButton}
            disabled={!canMark || marking}
            onClick={() => void handleMarkReceived()}
          >
            {marking ? "Encaissement…" : "Marquer virement reçu"}
          </button>
        </section>
      ) : null}
    </div>
  );
}
