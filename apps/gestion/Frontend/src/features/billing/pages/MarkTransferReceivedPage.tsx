import { useState, type FormEvent } from "react";

import type { BankTransferPendingLookupResponse } from "@coworkprysme/shared";

import { lookupBankTransfer, markBankTransferReceived } from "../../../lib/billing-api.js";
import styles from "./MarkTransferReceivedPage.module.css";

function formatEuroFromCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

function formatSettledAt(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  try {
    return new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  } catch {
    return iso;
  }
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

  async function handleMarkReceived(options?: { withQonto: boolean }) {
    if (!lookup?.reservationReference) {
      return;
    }
    const suggestion = lookup.qontoSuggestion;
    const useQonto =
      options?.withQonto === true &&
      suggestion?.matchStatus === "exact" &&
      Boolean(suggestion.qontoTxId);

    setMarking(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await markBankTransferReceived({
        reference: lookup.reservationReference,
        ...(useQonto ? { qontoTxId: suggestion!.qontoTxId } : {}),
      });
      setSuccess(
        `Virement encaissé — ${result.reservationReference} confirmée (${formatEuroFromCents(result.amountReceivedCents)})${
          result.qontoTxId ? " · lié Qonto" : ""
        }.`,
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

  const suggestion = lookup?.qontoSuggestion;
  const canConfirmQonto = canMark && suggestion?.matchStatus === "exact";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Encaisser un virement</h1>
        <p className={styles.lead}>
          Saisissez la référence de réservation (RES-…) ou de facture proforma pour marquer le
          virement comme reçu. Si Qonto a détecté une correspondance, elle apparaît en suggestion —
          la confirmation reste toujours manuelle.
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

          {suggestion ? (
            <div
              className={
                suggestion.matchStatus === "exact"
                  ? styles.suggestionExact
                  : styles.suggestionMismatch
              }
              aria-label="Suggestion Qonto"
            >
              <p className={styles.suggestionTitle}>
                {suggestion.matchStatus === "exact"
                  ? "Suggestion Qonto — correspondance exacte"
                  : "Suggestion Qonto — montant incohérent"}
              </p>
              <p className={styles.previewRow}>
                <span>Montant observé</span>
                <strong>{formatEuroFromCents(suggestion.amountCents)}</strong>
              </p>
              <p className={styles.previewRow}>
                <span>Date</span>
                <strong>{formatSettledAt(suggestion.settledAt)}</strong>
              </p>
              {suggestion.observedLabel ? (
                <p className={styles.previewRow}>
                  <span>Libellé</span>
                  <strong>{suggestion.observedLabel}</strong>
                </p>
              ) : null}
              {suggestion.matchStatus === "amount_mismatch" ? (
                <p className={styles.suggestionHint}>
                  Le montant Qonto ne correspond pas au solde dû. Vous pouvez quand même encaisser
                  manuellement (sans lier la transaction), après vérification.
                </p>
              ) : (
                <p className={styles.suggestionHint}>
                  Confirmez explicitement pour encaisser et lier cette transaction Qonto.
                </p>
              )}
            </div>
          ) : (
            <p className={styles.suggestionHint}>
              Aucune correspondance Qonto automatique — encaissement manuel possible comme
              auparavant.
            </p>
          )}

          <div className={styles.actions}>
            {canConfirmQonto ? (
              <button
                type="button"
                className={styles.primaryButton}
                disabled={marking}
                onClick={() => void handleMarkReceived({ withQonto: true })}
              >
                {marking ? "Encaissement…" : "Confirmer suggestion Qonto"}
              </button>
            ) : null}
            <button
              type="button"
              className={canConfirmQonto ? styles.secondaryButton : styles.primaryButton}
              disabled={!canMark || marking}
              onClick={() => void handleMarkReceived({ withQonto: false })}
            >
              {marking
                ? "Encaissement…"
                : canConfirmQonto
                  ? "Marquer reçu (manuel)"
                  : "Marquer virement reçu"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
