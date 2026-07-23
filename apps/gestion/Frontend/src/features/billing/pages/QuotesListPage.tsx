import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { QuoteStatus, StaffQuoteListItem } from "@coworkprysme/shared";

import {
  deleteQuoteDraft,
  expireQuote,
  listQuotes,
  refuseQuote,
  STAFF_QUOTE_ACCEPT_AVAILABLE,
} from "../../../lib/billing-quotes-api.js";
import { BillingStats } from "../components/BillingStats.js";
import styles from "../BillingPages.module.css";

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  refused: "Refusé",
  expired: "Expiré",
};

function badgeClass(status: QuoteStatus): string {
  switch (status) {
    case "draft":
      return `${styles.badge} ${styles.badgeDraft}`;
    case "sent":
      return `${styles.badge} ${styles.badgeSent}`;
    case "accepted":
      return `${styles.badge} ${styles.badgeAccepted}`;
    case "refused":
      return `${styles.badge} ${styles.badgeRefused}`;
    case "expired":
      return `${styles.badge} ${styles.badgeExpired}`;
    default:
      return styles.badge ?? "";
  }
}

function formatEuroFromCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  } catch {
    return iso;
  }
}

function clientLabel(quote: StaffQuoteListItem): string {
  if (quote.prospect?.displayName) return quote.prospect.displayName;
  const name = [quote.prospect?.firstName, quote.prospect?.lastName].filter(Boolean).join(" ");
  if (name) return name;
  return quote.prospect?.email ?? quote.cardexId ?? "—";
}

export function QuotesListPage() {
  const [quotes, setQuotes] = useState<StaffQuoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<QuoteStatus | "">("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listQuotes({
        ...(status ? { status } : {}),
        ...(q.trim() ? { q: q.trim() } : {}),
        page: 1,
        pageSize: 50,
      });
      setQuotes(result.quotes);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les devis.");
      setQuotes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const quoteStats = useMemo(() => {
    let draft = 0;
    let sent = 0;
    let accepted = 0;
    for (const quote of quotes) {
      if (quote.status === "draft") draft += 1;
      else if (quote.status === "sent") sent += 1;
      else if (quote.status === "accepted") accepted += 1;
    }
    return [
      {
        key: "draft",
        label: "Brouillons",
        value: String(draft),
        accent: "var(--color-secondary)",
      },
      {
        key: "sent",
        label: "Envoyés",
        value: String(sent),
        accent: "var(--color-primary)",
      },
      {
        key: "accepted",
        label: "Acceptés",
        value: String(accepted),
        accent: "var(--color-accent, var(--color-primary))",
      },
    ];
  }, [quotes]);

  async function runAction(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Devis</h1>
        </div>
        <Link to="/billing/quotes/new" className={styles.primaryButton}>
          Créer un devis
        </Link>
      </header>

      <BillingStats ariaLabel="Indicateurs devis" loading={loading} items={quoteStats} />

      <div className={styles.toolbar}>
        <input
          className={styles.input}
          type="search"
          placeholder="Recherche email, référence…"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          aria-label="Recherche devis"
        />
        <select
          className={styles.select}
          value={status}
          onChange={(event) => setStatus(event.target.value as QuoteStatus | "")}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          {(Object.keys(STATUS_LABELS) as QuoteStatus[]).map((key) => (
            <option key={key} value={key}>
              {STATUS_LABELS[key]}
            </option>
          ))}
        </select>
        <button type="button" className={styles.secondaryButton} onClick={() => void load()}>
          Actualiser
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.muted}>Chargement…</p> : null}

      {!loading && quotes.length === 0 ? (
        <p className={styles.emptyState}>Aucun devis pour ces filtres.</p>
      ) : null}

      {!loading && quotes.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Réf.</th>
                <th>Client</th>
                <th>Statut</th>
                <th>Total TTC</th>
                <th>Validité</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => {
                const busy = busyId === quote.id;
                return (
                  <tr key={quote.id}>
                    <td>
                      {quote.status === "draft" ? (
                        <Link to={`/billing/quotes/${quote.id}`}>{quote.reference}</Link>
                      ) : (
                        quote.reference
                      )}
                    </td>
                    <td>
                      <div>{clientLabel(quote)}</div>
                      {quote.prospect?.email ? (
                        <div className={styles.muted}>{quote.prospect.email}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className={badgeClass(quote.status)}>
                        {STATUS_LABELS[quote.status]}
                      </span>
                    </td>
                    <td>{formatEuroFromCents(quote.totals.ttc)}</td>
                    <td>{formatDate(quote.validUntil)}</td>
                    <td>
                      <div className={styles.rowActions}>
                        {quote.status === "draft" ? (
                          <>
                            <Link
                              to={`/billing/quotes/${quote.id}`}
                              className={styles.secondaryButton}
                            >
                              Éditer
                            </Link>
                            <button
                              type="button"
                              className={styles.dangerButton}
                              disabled={busy}
                              onClick={() =>
                                void runAction(quote.id, () => deleteQuoteDraft(quote.id))
                              }
                            >
                              Supprimer
                            </button>
                          </>
                        ) : null}
                        {quote.status === "sent" ? (
                          <>
                            <button
                              type="button"
                              className={styles.primaryButton}
                              disabled={!STAFF_QUOTE_ACCEPT_AVAILABLE || busy}
                              title={
                                STAFF_QUOTE_ACCEPT_AVAILABLE
                                  ? "Marquer le devis comme accepté"
                                  : "Disponible après AcceptQuote (#8)"
                              }
                            >
                              Devis accepté
                            </button>
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={busy}
                              onClick={() => void runAction(quote.id, () => refuseQuote(quote.id))}
                            >
                              Refuser
                            </button>
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={busy}
                              onClick={() => void runAction(quote.id, () => expireQuote(quote.id))}
                            >
                              Expirer
                            </button>
                          </>
                        ) : null}
                      </div>
                      {quote.status === "sent" && !STAFF_QUOTE_ACCEPT_AVAILABLE ? (
                        <p className={styles.hintNote} style={{ marginTop: "0.45rem" }}>
                          Acceptation staff désactivée jusqu’au chantier #8.
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && total > 0 ? <p className={styles.muted}>{total} devis au total</p> : null}
    </div>
  );
}
