import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import type {
  BankTransferPendingListItem,
  BankTransferPendingLookupResponse,
  BankTransferValidatedListItem,
} from "@coworkprysme/shared";

import {
  listBankTransfers,
  lookupBankTransfer,
  markBankTransferReceived,
} from "../../../lib/billing-api.js";
import { BillingStats } from "../components/BillingStats.js";
import styles from "./MarkTransferReceivedPage.module.css";

function formatEuroFromCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  try {
    return new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  } catch {
    return iso;
  }
}

function clientDisplay(row: { clientLabel: string; companyName?: string | null }): string {
  if (row.companyName) {
    return `${row.clientLabel} · ${row.companyName}`;
  }
  return row.clientLabel;
}

export function MarkTransferReceivedPage() {
  const [pending, setPending] = useState<BankTransferPendingListItem[]>([]);
  const [validated, setValidated] = useState<BankTransferValidatedListItem[]>([]);
  const [validatedDays, setValidatedDays] = useState(60);
  const [validatedOpen, setValidatedOpen] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [reference, setReference] = useState("");
  const [lookup, setLookup] = useState<BankTransferPendingLookupResponse | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [markingRef, setMarkingRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadList = useCallback(
    async (days?: number) => {
      const lookback = days ?? validatedDays;
      setListLoading(true);
      setListError(null);
      try {
        const result = await listBankTransfers(lookback);
        setPending(result.pending);
        setValidated(result.validated);
        setValidatedDays(result.validatedDays);
      } catch (err) {
        setListError(err instanceof Error ? err.message : "Impossible de charger les virements.");
        setPending([]);
        setValidated([]);
      } finally {
        setListLoading(false);
      }
    },
    [validatedDays],
  );

  useEffect(() => {
    void loadList(60);
    // Initial load only — subsequent refreshes via Actualiser / mark / blur.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  const pendingBalanceCents = useMemo(
    () => pending.reduce((sum, row) => sum + (row.balanceDueCents ?? 0), 0),
    [pending],
  );

  const transferStats = useMemo(
    () => [
      {
        key: "pending",
        label: "En attente",
        value: String(pending.length),
        accent: "var(--color-primary)",
      },
      {
        key: "balance",
        label: "Solde total dû",
        value: formatEuroFromCents(pendingBalanceCents),
        accent: "var(--color-accent, var(--color-primary))",
      },
      {
        key: "validated",
        label: `Validés (${validatedDays}j)`,
        value: String(validated.length),
        accent: "var(--color-secondary)",
      },
    ],
    [pending.length, pendingBalanceCents, validated.length, validatedDays],
  );

  async function handleLookup(event: FormEvent) {
    event.preventDefault();
    setLookupLoading(true);
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
      setLookupLoading(false);
    }
  }

  async function handleMarkReceived(options: {
    reservationReference: string;
    withQonto: boolean;
    qontoTxId?: string;
  }) {
    const useQonto = options.withQonto && Boolean(options.qontoTxId);
    setMarkingRef(options.reservationReference);
    setError(null);
    setSuccess(null);
    try {
      const result = await markBankTransferReceived({
        reference: options.reservationReference,
        ...(useQonto ? { qontoTxId: options.qontoTxId } : {}),
      });
      setSuccess(
        `Virement encaissé — ${result.reservationReference} confirmée (${formatEuroFromCents(result.amountReceivedCents)})${
          result.qontoTxId ? " · lié Qonto" : ""
        }.`,
      );
      setLookup(null);
      setReference("");
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Encaissement impossible.");
    } finally {
      setMarkingRef(null);
    }
  }

  const canMarkLookup =
    lookup?.found === true &&
    lookup.reservationStatus === "awaiting_payment" &&
    lookup.awaitingPaymentMethod === "bank_transfer" &&
    (lookup.amountDueCents ?? 0) > 0;

  const lookupSuggestion = lookup?.qontoSuggestion;
  const canConfirmLookupQonto = canMarkLookup && lookupSuggestion?.matchStatus === "exact";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Suivi des virements</h1>
        <p className={styles.lead}>
          Les virements en attente s’affichent automatiquement. Marquez-les reçus depuis la liste,
          ou recherchez une référence précise. Une suggestion Qonto n’est jamais appliquée sans
          confirmation explicite.
        </p>
      </header>

      <BillingStats ariaLabel="Indicateurs virements" loading={listLoading} items={transferStats} />

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
      {listError ? (
        <p className={styles.error} role="alert">
          {listError}
        </p>
      ) : null}

      <section className={styles.section} aria-labelledby="transfers-pending-title">
        <div className={styles.sectionHead}>
          <h2 id="transfers-pending-title" className={styles.sectionTitle}>
            En attente
            {!listLoading ? <span className={styles.count}> ({pending.length})</span> : null}
          </h2>
          <button type="button" className={styles.secondaryButton} onClick={() => void loadList()}>
            Actualiser
          </button>
        </div>

        {listLoading ? <p className={styles.muted}>Chargement…</p> : null}
        {!listLoading && pending.length === 0 ? (
          <p className={styles.emptyState}>Aucun virement en attente.</p>
        ) : null}

        {!listLoading && pending.length > 0 ? (
          <ul className={styles.list}>
            {pending.map((row) => {
              const marking = markingRef === row.reservationReference;
              const suggestion = row.qontoSuggestion;
              const canQonto = suggestion?.matchStatus === "exact";
              return (
                <li key={row.reservationId} className={styles.card}>
                  <div className={styles.cardMain}>
                    <div className={styles.cardTitleRow}>
                      <strong className={styles.cardTitle}>{row.reservationReference}</strong>
                      {suggestion ? (
                        <span
                          className={
                            suggestion.matchStatus === "exact"
                              ? styles.badgeQonto
                              : styles.badgeQontoMismatch
                          }
                        >
                          {suggestion.matchStatus === "exact"
                            ? `Qonto · ${formatEuroFromCents(suggestion.amountCents)}`
                            : "Qonto · montant différent"}
                        </span>
                      ) : null}
                    </div>
                    <p className={styles.meta}>{clientDisplay(row)}</p>
                    <p className={styles.meta}>
                      {row.spaceName} · {formatDateTime(row.startAt)} → {formatDateTime(row.endAt)}
                    </p>
                    <p className={styles.meta}>
                      Solde {formatEuroFromCents(row.balanceDueCents)}
                      {row.awaitingPaymentExpiresAt
                        ? ` · échéance ${formatDateTime(row.awaitingPaymentExpiresAt)}`
                        : ""}
                    </p>
                  </div>
                  <div className={styles.cardActions}>
                    {canQonto ? (
                      <button
                        type="button"
                        className={styles.primaryButton}
                        disabled={marking}
                        onClick={() =>
                          void handleMarkReceived({
                            reservationReference: row.reservationReference,
                            withQonto: true,
                            qontoTxId: suggestion.qontoTxId,
                          })
                        }
                      >
                        {marking ? "Encaissement…" : "Confirmer Qonto"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={canQonto ? styles.secondaryButton : styles.primaryButton}
                      disabled={marking}
                      onClick={() =>
                        void handleMarkReceived({
                          reservationReference: row.reservationReference,
                          withQonto: false,
                        })
                      }
                    >
                      {marking ? "Encaissement…" : "Marquer reçu"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="transfers-validated-title">
        <button
          type="button"
          className={styles.disclosure}
          aria-expanded={validatedOpen}
          aria-controls="transfers-validated-panel"
          onClick={() => setValidatedOpen((open) => !open)}
        >
          <span id="transfers-validated-title" className={styles.sectionTitle}>
            Validés
            {!listLoading ? <span className={styles.count}> ({validated.length})</span> : null}
            <span className={styles.pendingHint}> · {validatedDays} jours</span>
          </span>
          <span className={validatedOpen ? styles.chevronOpen : styles.chevron} aria-hidden="true">
            ▾
          </span>
        </button>

        {validatedOpen ? (
          <div id="transfers-validated-panel" className={styles.validatedPanel}>
            <label className={styles.daysLabel}>
              Période (jours)
              <input
                className={styles.daysInput}
                type="number"
                min={1}
                max={365}
                value={validatedDays}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next) && next >= 1) {
                    const clamped = Math.min(365, Math.floor(next));
                    setValidatedDays(clamped);
                  }
                }}
                onBlur={() => void loadList(validatedDays)}
              />
            </label>

            {!listLoading && validated.length === 0 ? (
              <p className={styles.emptyState}>Aucun virement validé sur cette période.</p>
            ) : null}

            {!listLoading && validated.length > 0 ? (
              <ul className={styles.list}>
                {validated.map((row) => (
                  <li key={row.paymentId} className={styles.card}>
                    <div className={styles.cardMain}>
                      <div className={styles.cardTitleRow}>
                        <strong className={styles.cardTitle}>{row.reservationReference}</strong>
                        <span className={styles.badgeValidated}>
                          {row.origin === "qonto" ? "Confirmé via Qonto" : "Confirmé manuellement"}
                        </span>
                      </div>
                      <p className={styles.meta}>{clientDisplay(row)}</p>
                      <p className={styles.meta}>
                        {row.spaceName} · {formatEuroFromCents(row.amountReceivedCents)} ·{" "}
                        {formatDateTime(row.receivedAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="transfers-lookup-title">
        <h2 id="transfers-lookup-title" className={styles.sectionTitle}>
          Recherche par référence
        </h2>
        <p className={styles.muted}>
          Complément à la liste — saisissez une référence RES-… ou PF-… pour un virement précis.
        </p>

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
              disabled={lookupLoading || !reference.trim()}
            >
              {lookupLoading ? "Recherche…" : "Rechercher"}
            </button>
          </div>
        </form>

        {lookup?.found && lookup.reservationReference ? (
          <div className={styles.preview} aria-label="Aperçu du virement">
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

            {lookupSuggestion ? (
              <div
                className={
                  lookupSuggestion.matchStatus === "exact"
                    ? styles.suggestionExact
                    : styles.suggestionMismatch
                }
              >
                <p className={styles.suggestionTitle}>
                  {lookupSuggestion.matchStatus === "exact"
                    ? "Suggestion Qonto — correspondance exacte"
                    : "Suggestion Qonto — montant incohérent"}
                </p>
                <p className={styles.previewRow}>
                  <span>Montant observé</span>
                  <strong>{formatEuroFromCents(lookupSuggestion.amountCents)}</strong>
                </p>
              </div>
            ) : (
              <p className={styles.suggestionHint}>Aucune suggestion Qonto pour cette référence.</p>
            )}

            <div className={styles.actions}>
              {canConfirmLookupQonto ? (
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={Boolean(markingRef)}
                  onClick={() =>
                    void handleMarkReceived({
                      reservationReference: lookup.reservationReference!,
                      withQonto: true,
                      qontoTxId: lookupSuggestion!.qontoTxId,
                    })
                  }
                >
                  {markingRef ? "Encaissement…" : "Confirmer suggestion Qonto"}
                </button>
              ) : null}
              <button
                type="button"
                className={canConfirmLookupQonto ? styles.secondaryButton : styles.primaryButton}
                disabled={!canMarkLookup || Boolean(markingRef)}
                onClick={() =>
                  void handleMarkReceived({
                    reservationReference: lookup.reservationReference!,
                    withQonto: false,
                  })
                }
              >
                {markingRef
                  ? "Encaissement…"
                  : canConfirmLookupQonto
                    ? "Marquer reçu (manuel)"
                    : "Marquer virement reçu"}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
