import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  BankTransferPendingListItem,
  BankTransferValidatedListItem,
} from "@coworkprysme/shared";

import { listBankTransfers, markBankTransferReceived } from "../../../lib/billing-api.js";
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

function normalizeFilter(value: string): string {
  return value.trim().toLowerCase();
}

function matchesTransferFilter(
  row: {
    reservationReference: string;
    invoiceReference?: string;
    clientLabel: string;
    companyName?: string | null;
    spaceName: string;
  },
  query: string,
): boolean {
  if (!query) return true;
  const haystack = [
    row.reservationReference,
    row.invoiceReference ?? "",
    row.clientLabel,
    row.companyName ?? "",
    row.spaceName,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function ClientIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5.5 19.5c1.6-3 4-4.5 6.5-4.5s4.9 1.5 6.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpaceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 10h18M8 15h3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function MarkTransferReceivedPage() {
  const [pending, setPending] = useState<BankTransferPendingListItem[]>([]);
  const [validated, setValidated] = useState<BankTransferValidatedListItem[]>([]);
  const [validatedDays, setValidatedDays] = useState(60);
  const [validatedOpen, setValidatedOpen] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [filterQuery, setFilterQuery] = useState("");
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

  const filterNormalized = useMemo(() => normalizeFilter(filterQuery), [filterQuery]);

  const filteredPending = useMemo(
    () => pending.filter((row) => matchesTransferFilter(row, filterNormalized)),
    [pending, filterNormalized],
  );

  const filteredValidated = useMemo(
    () => validated.filter((row) => matchesTransferFilter(row, filterNormalized)),
    [validated, filterNormalized],
  );

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
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Encaissement impossible.");
    } finally {
      setMarkingRef(null);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Suivi des virements</h1>
      </header>

      <BillingStats ariaLabel="Indicateurs virements" loading={listLoading} items={transferStats} />

      <div className={styles.filterBar}>
        <input
          className={styles.filterInput}
          type="search"
          value={filterQuery}
          onChange={(event) => setFilterQuery(event.target.value)}
          placeholder="Filtrer par référence, client, société ou espace…"
          aria-label="Filtrer les virements"
          autoComplete="off"
        />
        <button type="button" className={styles.secondaryButton} onClick={() => void loadList()}>
          Actualiser
        </button>
      </div>

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
            {!listLoading ? (
              <span className={styles.count}> ({filteredPending.length})</span>
            ) : null}
          </h2>
        </div>

        {listLoading ? <p className={styles.muted}>Chargement…</p> : null}
        {!listLoading && filteredPending.length === 0 ? (
          <p className={styles.emptyState}>
            {pending.length === 0
              ? "Aucun virement en attente."
              : "Aucun virement en attente pour ce filtre."}
          </p>
        ) : null}

        {!listLoading && filteredPending.length > 0 ? (
          <ul className={styles.list}>
            {filteredPending.map((row) => {
              const marking = markingRef === row.reservationReference;
              const suggestion = row.qontoSuggestion;
              const canQonto = suggestion?.matchStatus === "exact";
              return (
                <li key={row.reservationId} className={`${styles.card} ${styles.cardPending}`}>
                  <div className={styles.cardMain}>
                    <div className={styles.cardTitleRow}>
                      <strong className={styles.cardTitle}>{row.reservationReference}</strong>
                      <span className={styles.badgePending}>En attente</span>
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
                    <div className={styles.meta}>
                      <p className={styles.metaRow}>
                        <ClientIcon />
                        <span className={styles.metaStrong}>{clientDisplay(row)}</span>
                      </p>
                      <p className={styles.metaRow}>
                        <SpaceIcon />
                        <span>
                          {row.spaceName} · {formatDateTime(row.startAt)} →{" "}
                          {formatDateTime(row.endAt)}
                        </span>
                      </p>
                    </div>
                    <div className={styles.balanceRow}>
                      <span className={styles.balanceAmount}>
                        {formatEuroFromCents(row.balanceDueCents)}
                      </span>
                      {row.awaitingPaymentExpiresAt ? (
                        <span className={styles.balanceHint}>
                          Échéance {formatDateTime(row.awaitingPaymentExpiresAt)}
                        </span>
                      ) : null}
                    </div>
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
            {!listLoading ? (
              <span className={styles.count}> ({filteredValidated.length})</span>
            ) : null}
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

            {!listLoading && filteredValidated.length === 0 ? (
              <p className={styles.emptyState}>
                {validated.length === 0
                  ? "Aucun virement validé sur cette période."
                  : "Aucun virement validé pour ce filtre."}
              </p>
            ) : null}

            {!listLoading && filteredValidated.length > 0 ? (
              <ul className={styles.list}>
                {filteredValidated.map((row) => (
                  <li key={row.paymentId} className={styles.card}>
                    <div className={styles.cardMain}>
                      <div className={styles.cardTitleRow}>
                        <strong className={styles.cardTitle}>{row.reservationReference}</strong>
                        <span className={styles.badgeValidated}>
                          {row.origin === "qonto" ? "Confirmé via Qonto" : "Confirmé manuellement"}
                        </span>
                      </div>
                      <div className={styles.meta}>
                        <p className={styles.metaRow}>
                          <ClientIcon />
                          <span className={styles.metaStrong}>{clientDisplay(row)}</span>
                        </p>
                        <p className={styles.metaRow}>
                          <SpaceIcon />
                          <span>
                            {row.spaceName} · {formatEuroFromCents(row.amountReceivedCents)} ·{" "}
                            {formatDateTime(row.receivedAt)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
