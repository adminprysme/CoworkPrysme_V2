import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  parseEuroInputToCents,
  type StaffBillingInvoiceDetailResponse,
  type StaffBillingInvoiceListItem,
  type StaffBillingInvoiceListSummary,
  type StaffInvoiceStatus,
  type StaffPaymentMethod,
} from "@coworkprysme/shared";

import {
  billingInvoicePdfUrl,
  fetchBillingInvoiceDetail,
  listBillingInvoices,
  markBillingInvoicePaid,
} from "../../../lib/billing-api.js";
import { RESERVATION_STATUS_LABELS } from "../../planning/planning-ui.js";
import { BillingStats } from "../components/BillingStats.js";
import styles from "../BillingPages.module.css";

const STATUS_LABELS: Record<StaffInvoiceStatus, string> = {
  proforma: "Proforma",
  issued: "Émise",
  partially_paid: "Partiellement payée",
  paid: "Payée",
  overdue: "En retard",
  cancelled: "Annulée",
};

function statusBadgeLabel(status: StaffInvoiceStatus): string {
  if (status === "proforma") return "Non payée";
  return STATUS_LABELS[status];
}

const PAYMENT_METHOD_LABELS: Record<StaffPaymentMethod, string> = {
  card: "Carte",
  transfer: "Virement",
  direct_debit: "Prélèvement",
  cash: "Espèces",
  manual: "Manuel",
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

function paymentMethodsLabel(methods: StaffPaymentMethod[]): string {
  if (methods.length === 0) return "—";
  return methods.map((method) => PAYMENT_METHOD_LABELS[method]).join(", ");
}

const EMPTY_SUMMARY: StaffBillingInvoiceListSummary = {
  invoiceCount: 0,
  balanceDueCents: 0,
  paidTotalCents: 0,
};

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

export function InvoicesListPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<StaffBillingInvoiceListItem[]>([]);
  const [summary, setSummary] = useState<StaffBillingInvoiceListSummary>(EMPTY_SUMMARY);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StaffInvoiceStatus | "">("");
  const [paymentMethod, setPaymentMethod] = useState<StaffPaymentMethod | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<StaffBillingInvoiceDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"summary" | "reservation" | "history">("summary");

  const [markTarget, setMarkTarget] = useState<StaffBillingInvoiceListItem | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [markConfirming, setMarkConfirming] = useState(false);
  const [markBusy, setMarkBusy] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listBillingInvoices({
        ...(q.trim() ? { q: q.trim() } : {}),
        ...(status ? { status } : {}),
        ...(paymentMethod ? { paymentMethod } : {}),
        page: 1,
        pageSize: 50,
      });
      setInvoices(result.invoices);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les factures.");
      setInvoices([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [q, status, paymentMethod]);

  useEffect(() => {
    void load();
  }, [load]);

  const invoiceStats = useMemo(
    () => [
      {
        key: "total",
        label: "Factures",
        value: String(summary.invoiceCount),
        accent: "var(--color-primary)",
      },
      {
        key: "due",
        label: "Total dû",
        value: formatEuroFromCents(summary.balanceDueCents),
        accent: "var(--color-accent, var(--color-primary))",
      },
      {
        key: "collected",
        label: "Encaissé",
        value: formatEuroFromCents(summary.paidTotalCents),
        accent: "var(--color-secondary)",
      },
    ],
    [summary],
  );

  const openDetail = useCallback(async (invoiceId: string) => {
    setDetail(null);
    setDetailError(null);
    setDetailTab("summary");
    setDetailLoading(true);
    try {
      const payload = await fetchBillingInvoiceDetail(invoiceId);
      setDetail(payload);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Impossible de charger le détail.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openMarkPaid = useCallback((invoice: StaffBillingInvoiceListItem) => {
    setMarkTarget(invoice);
    setAmountInput((invoice.totals.balanceDue / 100).toFixed(2).replace(".", ","));
    setNoteInput("");
    setMarkConfirming(false);
    setMarkBusy(false);
    setMarkError(null);
  }, []);

  const closeMarkPaid = useCallback(() => {
    if (markBusy) return;
    setMarkTarget(null);
    setMarkConfirming(false);
    setMarkError(null);
  }, [markBusy]);

  const submitMarkPaid = useCallback(async () => {
    if (!markTarget) return;
    const amountReceived = parseEuroInputToCents(amountInput);
    if (amountReceived == null || amountReceived <= 0) {
      setMarkError("Indiquez un montant reçu valide.");
      return;
    }
    if (amountReceived > markTarget.totals.balanceDue) {
      setMarkError(
        `Le montant dépasse le solde dû (${formatEuroFromCents(markTarget.totals.balanceDue)}).`,
      );
      return;
    }
    if (!markConfirming) {
      setMarkConfirming(true);
      setMarkError(null);
      return;
    }

    setMarkBusy(true);
    setMarkError(null);
    try {
      await markBillingInvoicePaid(markTarget.id, {
        amountReceived,
        ...(noteInput.trim() ? { note: noteInput.trim() } : {}),
      });
      setMarkTarget(null);
      setMarkConfirming(false);
      await load();
    } catch (err) {
      setMarkError(err instanceof Error ? err.message : "Enregistrement impossible.");
      setMarkConfirming(false);
    } finally {
      setMarkBusy(false);
    }
  }, [amountInput, load, markConfirming, markTarget, noteInput]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Factures</h1>
        </div>
      </header>

      <BillingStats ariaLabel="Indicateurs factures" loading={loading} items={invoiceStats} />

      <div className={styles.toolbar}>
        <input
          className={styles.input}
          type="search"
          placeholder="Client, n° facture, email, entreprise…"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          aria-label="Recherche factures"
        />
        <select
          className={`${styles.select} ${styles.filterSelect}`}
          value={status}
          onChange={(event) => setStatus(event.target.value as StaffInvoiceStatus | "")}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          {(Object.keys(STATUS_LABELS) as StaffInvoiceStatus[]).map((key) => (
            <option key={key} value={key}>
              {key === "proforma" ? "Non payée" : STATUS_LABELS[key]}
            </option>
          ))}
        </select>
        <select
          className={`${styles.select} ${styles.filterSelect}`}
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value as StaffPaymentMethod | "")}
          aria-label="Filtrer par moyen de paiement"
        >
          <option value="">Moyen de paiement</option>
          {(Object.keys(PAYMENT_METHOD_LABELS) as StaffPaymentMethod[]).map((key) => (
            <option key={key} value={key}>
              {PAYMENT_METHOD_LABELS[key]}
            </option>
          ))}
        </select>
        <button type="button" className={styles.secondaryButton} onClick={() => void load()}>
          Actualiser
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.muted}>Chargement…</p> : null}

      {!loading && invoices.length === 0 ? (
        <p className={styles.emptyState}>Aucune facture pour ces filtres.</p>
      ) : null}

      {!loading && invoices.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>Statut</th>
                <th>Paiement</th>
                <th>Total TTC</th>
                <th>Solde</th>
                <th>Émise le</th>
                <th className={styles.actionsCol}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const canMarkPaid = invoice.totals.balanceDue > 0 && invoice.status !== "cancelled";
                return (
                  <tr key={invoice.id}>
                    <td>
                      <div className={styles.clientPrimary}>{invoice.reference}</div>
                    </td>
                    <td>
                      {invoice.companyLegalName ? (
                        <>
                          <div className={styles.clientPrimary}>{invoice.companyLegalName}</div>
                          <div className={styles.clientSecondary}>{invoice.clientLabel}</div>
                        </>
                      ) : (
                        <div className={styles.clientPrimary}>{invoice.clientLabel}</div>
                      )}
                      {invoice.emails[0] ? (
                        <div className={styles.clientSecondary}>{invoice.emails[0]}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className={styles.statusChip} data-status={invoice.status}>
                        {statusBadgeLabel(invoice.status)}
                      </span>
                    </td>
                    <td>{paymentMethodsLabel(invoice.paymentMethods)}</td>
                    <td>{formatEuroFromCents(invoice.totals.ttc)}</td>
                    <td>{formatEuroFromCents(invoice.totals.balanceDue)}</td>
                    <td>{formatDate(invoice.issuedAt ?? invoice.createdAt)}</td>
                    <td className={styles.actionsCol}>
                      <div className={styles.iconActions}>
                        <button
                          type="button"
                          className={styles.iconButton}
                          title="Voir le détail"
                          aria-label={`Détail ${invoice.reference}`}
                          onClick={() => void openDetail(invoice.id)}
                        >
                          <EyeIcon />
                        </button>
                        <a
                          className={styles.iconButton}
                          href={billingInvoicePdfUrl(invoice.id)}
                          target="_blank"
                          rel="noreferrer"
                          title="Télécharger le PDF"
                          aria-label={`PDF ${invoice.reference}`}
                        >
                          <DownloadIcon />
                        </a>
                        <button
                          type="button"
                          className={styles.iconButton}
                          title="Marquer comme payé"
                          aria-label={`Marquer payé ${invoice.reference}`}
                          disabled={!canMarkPaid}
                          onClick={() => openMarkPaid(invoice)}
                        >
                          <CheckIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

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
            aria-labelledby="invoice-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.dialogHeader}>
              <div>
                <h2 id="invoice-detail-title" className={styles.dialogTitle}>
                  {detail?.reference ?? "Détail facture"}
                </h2>
                <div className={styles.dialogSubtitle}>
                  {detail ? (
                    <>
                      <span className={styles.statusChip} data-status={detail.status}>
                        {statusBadgeLabel(detail.status)}
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
            <div className={styles.tabs} role="tablist" aria-label="Sections facture">
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
                aria-selected={detailTab === "reservation"}
                className={detailTab === "reservation" ? styles.tabActive : styles.tab}
                onClick={() => setDetailTab("reservation")}
              >
                Réservation
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={detailTab === "history"}
                className={detailTab === "history" ? styles.tabActive : styles.tab}
                onClick={() => setDetailTab("history")}
              >
                Historique
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
                          ["Payé", detail.totals.paidTotal],
                          ["Solde", detail.totals.balanceDue],
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
                        <dd>{detail.clientLabel}</dd>
                      </div>
                      <div className={styles.detailItem}>
                        <dt>Entreprise</dt>
                        <dd>{detail.companyLegalName ?? "—"}</dd>
                      </div>
                      <div className={styles.detailItem}>
                        <dt>Email</dt>
                        <dd>{detail.emails[0] ?? "—"}</dd>
                      </div>
                      <div className={styles.detailItem}>
                        <dt>Devis</dt>
                        <dd>{detail.quote?.reference ?? "—"}</dd>
                      </div>
                      <div className={styles.detailItem}>
                        <dt>Émise le</dt>
                        <dd>{formatDate(detail.issuedAt ?? detail.createdAt)}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
              ) : null}

              {detail && detailTab === "reservation" ? (
                <div className={styles.detailTabPanel}>
                  <section className={styles.detailSection}>
                    <h3 className={styles.detailSectionTitle}>Réservations</h3>
                    {detail.reservations.length === 0 ? (
                      <p className={styles.muted}>Aucune réservation liée.</p>
                    ) : (
                      <ul className={styles.detailList}>
                        {detail.reservations.map((reservation) => (
                          <li key={reservation.id} className={styles.detailListItem}>
                            <strong>{reservation.spaceName}</strong>
                            <div className={styles.detailListMeta}>
                              <span className={styles.muted}>{reservation.reference}</span>
                              <span className={styles.metaChip}>
                                {RESERVATION_STATUS_LABELS[reservation.status] ??
                                  reservation.status}
                              </span>
                            </div>
                            <div className={styles.muted}>
                              {formatDateTime(reservation.startAt)} →{" "}
                              {formatDateTime(reservation.endAt)}
                            </div>
                            <div className={styles.reservationActions}>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => {
                                  setDetail(null);
                                  setDetailError(null);
                                  navigate(
                                    `/planning?reservation=${encodeURIComponent(reservation.id)}`,
                                  );
                                }}
                              >
                                Ouvrir la réservation
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {detail.lines.length > 0 ? (
                    <section className={styles.detailSection}>
                      <h3 className={styles.detailSectionTitle}>Lignes</h3>
                      <ul className={styles.detailList}>
                        {detail.lines.map((line, index) => (
                          <li key={`${line.label}-${index}`} className={styles.detailListItem}>
                            <strong>{line.label}</strong>
                            <div className={styles.muted}>
                              {line.kind} · qty {line.qty} · {formatEuroFromCents(line.totalTTC)}{" "}
                              TTC
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              ) : null}

              {detail && detailTab === "history" ? (
                <div className={styles.detailTabPanel}>
                  <section className={styles.detailSection}>
                    <h3 className={styles.detailSectionTitle}>Paiements</h3>
                    {detail.payments.length === 0 ? (
                      <p className={styles.muted}>Aucun paiement enregistré.</p>
                    ) : (
                      <ul className={styles.detailList}>
                        {detail.payments.map((payment) => (
                          <li key={payment.id} className={styles.detailListItem}>
                            <strong>
                              {formatEuroFromCents(payment.amount)} ·{" "}
                              {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                            </strong>
                            <div className={styles.muted}>{formatDateTime(payment.receivedAt)}</div>
                            {payment.manualNote ? (
                              <div className={styles.muted}>Motif : {payment.manualNote}</div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {markTarget ? (
        <div className={styles.overlay} role="presentation" onClick={closeMarkPaid}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mark-paid-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.dialogHeader}>
              <div>
                <h2 id="mark-paid-title" className={styles.dialogTitle}>
                  Marquer comme payé
                </h2>
                <p className={styles.dialogSubtitle}>
                  {markTarget.reference} · solde {formatEuroFromCents(markTarget.totals.balanceDue)}
                </p>
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={closeMarkPaid}
                disabled={markBusy}
              >
                Fermer
              </button>
            </header>
            <div className={styles.dialogBody}>
              <label className={styles.label}>
                Montant reçu (€)
                <input
                  className={styles.input}
                  type="text"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(event) => {
                    setAmountInput(event.target.value);
                    setMarkConfirming(false);
                  }}
                  disabled={markBusy}
                />
              </label>
              <label className={styles.label}>
                Motif (optionnel)
                <textarea
                  className={styles.textarea}
                  value={noteInput}
                  onChange={(event) => {
                    setNoteInput(event.target.value);
                    setMarkConfirming(false);
                  }}
                  disabled={markBusy}
                  placeholder="Ex. chèque n°…, espèce en caisse…"
                />
              </label>
              {markConfirming ? (
                <div className={styles.confirmBox} role="group" aria-label="Confirmer le paiement">
                  <p className={styles.confirmText}>
                    Confirmer l’encaissement de{" "}
                    <strong>{formatEuroFromCents(parseEuroInputToCents(amountInput) ?? 0)}</strong>{" "}
                    sur {markTarget.reference} ?
                  </p>
                </div>
              ) : null}
              {markError ? <p className={styles.error}>{markError}</p> : null}
            </div>
            <footer className={styles.dialogFooter}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={closeMarkPaid}
                disabled={markBusy}
              >
                Annuler
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void submitMarkPaid()}
                disabled={markBusy}
              >
                {markBusy
                  ? "Enregistrement…"
                  : markConfirming
                    ? "Confirmer l’encaissement"
                    : "Continuer"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
