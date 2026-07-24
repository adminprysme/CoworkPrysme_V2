import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type {
  QuotePaymentMethod,
  QuotePaymentSituation,
  QuoteStatus,
  StaffQuote,
  StaffQuoteListItem,
} from "@coworkprysme/shared";

import {
  acceptQuote,
  deleteQuoteDraft,
  expireQuote,
  getQuote,
  listQuotes,
  quotePdfUrl,
  refuseQuote,
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

const PAYMENT_METHOD_LABELS: Record<QuotePaymentMethod, string> = {
  card: "Carte",
  bank_transfer: "Virement",
  direct_debit: "Prélèvement",
};

const PAYMENT_SITUATION_LABELS: Record<QuotePaymentSituation, string> = {
  immediate: "Immédiat",
  on_quote: "À la commande",
  deposit: "Acompte",
  net_30: "Net 30 jours",
};

function formatEuroFromCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  } catch {
    return iso;
  }
}

function contactLabelFromQuote(quote: StaffQuote): string {
  const prospect = quote.prospect;
  if (prospect?.displayName?.trim()) return prospect.displayName.trim();
  const name = [prospect?.firstName, prospect?.lastName].filter(Boolean).join(" ");
  if (name) return name;
  return prospect?.email ?? "—";
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4v10m0 0 3.5-3.5M12 14l-3.5-3.5M5 18.5h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="m14.5 5 4.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 7h14M9 7V5h6v2m-8 0 1 12h8l1-12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="m8.5 12.2 2.4 2.4 4.6-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8.2 8.2 15.8 15.8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function ExpireIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function QuotesListPage() {
  const [quotes, setQuotes] = useState<StaffQuoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<QuoteStatus | "">("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [detail, setDetail] = useState<StaffQuote | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"summary" | "lines" | "conditions">("summary");

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

  const openDetail = useCallback(async (quoteId: string) => {
    setDetail(null);
    setDetailError(null);
    setDetailTab("summary");
    setDetailLoading(true);
    try {
      const payload = await getQuote(quoteId);
      setDetail(payload);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Impossible de charger le détail.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

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

  const detailCompany = detail?.companyLegalName ?? detail?.prospect?.companyName?.trim() ?? null;
  const detailContact = detail?.clientLabel ?? (detail ? contactLabelFromQuote(detail) : "—");

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
                <th className={styles.actionsCol}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => {
                const busy = busyId === quote.id;
                return (
                  <tr key={quote.id}>
                    <td>
                      <div className={styles.clientPrimary}>{quote.reference}</div>
                    </td>
                    <td>
                      {quote.companyLegalName ? (
                        <>
                          <div className={styles.clientPrimary}>{quote.companyLegalName}</div>
                          <div className={styles.clientSecondary}>{quote.clientLabel}</div>
                        </>
                      ) : (
                        <div className={styles.clientPrimary}>{quote.clientLabel}</div>
                      )}
                      {quote.prospect?.email ? (
                        <div className={styles.clientSecondary}>{quote.prospect.email}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className={styles.statusChip} data-status={quote.status}>
                        {STATUS_LABELS[quote.status]}
                      </span>
                    </td>
                    <td>{formatEuroFromCents(quote.totals.ttc)}</td>
                    <td>{formatDate(quote.validUntil)}</td>
                    <td className={styles.actionsCol}>
                      <div className={styles.iconActions}>
                        <button
                          type="button"
                          className={styles.iconButton}
                          title="Voir le détail"
                          aria-label={`Détail ${quote.reference}`}
                          onClick={() => void openDetail(quote.id)}
                        >
                          <EyeIcon />
                        </button>
                        <a
                          className={styles.iconButton}
                          href={quotePdfUrl(quote.id)}
                          target="_blank"
                          rel="noreferrer"
                          title="Télécharger le PDF"
                          aria-label={`PDF ${quote.reference}`}
                        >
                          <DownloadIcon />
                        </a>
                        {quote.status === "draft" ? (
                          <>
                            <Link
                              to={`/billing/quotes/${quote.id}`}
                              className={styles.iconButton}
                              title="Éditer"
                              aria-label={`Éditer ${quote.reference}`}
                            >
                              <PencilIcon />
                            </Link>
                            <button
                              type="button"
                              className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                              title="Supprimer"
                              aria-label={`Supprimer ${quote.reference}`}
                              disabled={busy}
                              onClick={() =>
                                void runAction(quote.id, () => deleteQuoteDraft(quote.id))
                              }
                            >
                              <TrashIcon />
                            </button>
                          </>
                        ) : null}
                        {quote.status === "sent" ? (
                          <>
                            <button
                              type="button"
                              className={styles.iconButton}
                              title="Marquer comme accepté"
                              aria-label={`Accepter ${quote.reference}`}
                              disabled={busy}
                              onClick={() => void runAction(quote.id, () => acceptQuote(quote.id))}
                            >
                              <CheckIcon />
                            </button>
                            <button
                              type="button"
                              className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                              title="Refuser"
                              aria-label={`Refuser ${quote.reference}`}
                              disabled={busy}
                              onClick={() => void runAction(quote.id, () => refuseQuote(quote.id))}
                            >
                              <BanIcon />
                            </button>
                            <button
                              type="button"
                              className={styles.iconButton}
                              title="Expirer"
                              aria-label={`Expirer ${quote.reference}`}
                              disabled={busy}
                              onClick={() => void runAction(quote.id, () => expireQuote(quote.id))}
                            >
                              <ExpireIcon />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && total > 0 ? <p className={styles.muted}>{total} devis au total</p> : null}

      {detailLoading || detailError || detail ? (
        <div
          className={styles.overlay}
          role="presentation"
          onClick={() => {
            setDetail(null);
            setDetailError(null);
          }}
        >
          <div
            className={`${styles.dialog} ${styles.dialogWide}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quote-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.dialogHeader}>
              <div>
                <h2 id="quote-detail-title" className={styles.dialogTitle}>
                  {detail?.reference ?? "Détail devis"}
                </h2>
                <div className={styles.dialogSubtitle}>
                  {detail ? (
                    <>
                      <span className={styles.statusChip} data-status={detail.status}>
                        {STATUS_LABELS[detail.status]}
                      </span>
                      <span>{formatEuroFromCents(detail.totals.ttc)} TTC</span>
                    </>
                  ) : (
                    <span>Chargement…</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setDetail(null);
                  setDetailError(null);
                }}
              >
                Fermer
              </button>
            </header>
            <div className={styles.tabs} role="tablist" aria-label="Sections devis">
              <button
                type="button"
                role="tab"
                aria-selected={detailTab === "summary"}
                className={detailTab === "summary" ? styles.tabActive : styles.tab}
                onClick={() => setDetailTab("summary")}
              >
                Résumé
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={detailTab === "lines"}
                className={detailTab === "lines" ? styles.tabActive : styles.tab}
                onClick={() => setDetailTab("lines")}
              >
                Lignes
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={detailTab === "conditions"}
                className={detailTab === "conditions" ? styles.tabActive : styles.tab}
                onClick={() => setDetailTab("conditions")}
              >
                Conditions
              </button>
            </div>
            <div className={styles.dialogBody}>
              {detailLoading ? <p className={styles.muted}>Chargement du détail…</p> : null}
              {detailError ? <p className={styles.error}>{detailError}</p> : null}
              {detail && detailTab === "summary" ? (
                <div className={styles.detailTabPanel}>
                  <section className={styles.detailSection}>
                    <h3 className={styles.detailSectionTitle}>Montants</h3>
                    <div className={styles.amountCards}>
                      {(
                        [
                          ["HT", detail.totals.ht],
                          ["TVA", detail.totals.vat],
                          ["TTC", detail.totals.ttc],
                          ["Acompte", detail.depositAmountTTC ?? 0],
                        ] as const
                      ).map(([label, cents]) => (
                        <div key={label} className={styles.amountCard}>
                          <p className={styles.amountCardLabel}>{label}</p>
                          <p className={styles.amountCardValue}>{formatEuroFromCents(cents)}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className={styles.detailSection}>
                    <h3 className={styles.detailSectionTitle}>Client</h3>
                    <dl className={styles.detailGrid}>
                      <div className={styles.detailItem}>
                        <dt>Contact</dt>
                        <dd>{detailContact}</dd>
                      </div>
                      <div className={styles.detailItem}>
                        <dt>Entreprise</dt>
                        <dd>{detailCompany ?? "—"}</dd>
                      </div>
                      <div className={styles.detailItem}>
                        <dt>Email</dt>
                        <dd>{detail.prospect?.email ?? "—"}</dd>
                      </div>
                      <div className={styles.detailItem}>
                        <dt>Créé le</dt>
                        <dd>{formatDate(detail.createdAt)}</dd>
                      </div>
                      <div className={styles.detailItem}>
                        <dt>Validité</dt>
                        <dd>{formatDate(detail.validUntil)}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
              ) : null}

              {detail && detailTab === "lines" ? (
                <div className={styles.detailTabPanel}>
                  <section className={styles.detailSection}>
                    <h3 className={styles.detailSectionTitle}>Lignes</h3>
                    {detail.lines.length === 0 ? (
                      <p className={styles.muted}>Aucune ligne.</p>
                    ) : (
                      <ul className={styles.detailList}>
                        {detail.lines.map((line) => (
                          <li key={line.lineId} className={styles.detailListItem}>
                            <strong>{line.label}</strong>
                            <div className={styles.muted}>
                              {line.kind} · qty {line.qty} · {formatEuroFromCents(line.totalTTC)}{" "}
                              TTC
                            </div>
                            {line.startAt && line.endAt ? (
                              <div className={styles.muted}>
                                {formatDateTime(line.startAt)} → {formatDateTime(line.endAt)}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              ) : null}

              {detail && detailTab === "conditions" ? (
                <div className={styles.detailTabPanel}>
                  <section className={styles.detailSection}>
                    <h3 className={styles.detailSectionTitle}>Paiement & conditions</h3>
                    <dl className={styles.detailGrid}>
                      <div className={styles.detailItem}>
                        <dt>Acompte</dt>
                        <dd>
                          {detail.depositPercent}%
                          {detail.depositAmountTTC !== undefined
                            ? ` · ${formatEuroFromCents(detail.depositAmountTTC)} TTC`
                            : ""}
                        </dd>
                      </div>
                      <div className={styles.detailItem}>
                        <dt>Situation</dt>
                        <dd>
                          {detail.paymentSituation
                            ? PAYMENT_SITUATION_LABELS[detail.paymentSituation]
                            : "—"}
                        </dd>
                      </div>
                      <div className={styles.detailItem}>
                        <dt>Moyen préféré</dt>
                        <dd>
                          {detail.paymentMethodPreferred
                            ? PAYMENT_METHOD_LABELS[detail.paymentMethodPreferred]
                            : "—"}
                        </dd>
                      </div>
                      <div className={styles.detailItem}>
                        <dt>Échéance libellé</dt>
                        <dd>{detail.paymentTermsLabel ?? "—"}</dd>
                      </div>
                    </dl>
                    {detail.publicConditions ? (
                      <div className={styles.detailConditionsBlock}>
                        <p className={styles.detailConditionsLabel}>Conditions publiques</p>
                        <p className={styles.detailConditionsText}>{detail.publicConditions}</p>
                      </div>
                    ) : null}
                  </section>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
