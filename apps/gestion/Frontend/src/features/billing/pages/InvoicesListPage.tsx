import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  StaffBillingInvoiceListItem,
  StaffBillingInvoiceListSummary,
  StaffInvoiceStatus,
  StaffPaymentMethod,
} from "@coworkprysme/shared";

import { billingInvoicePdfUrl, listBillingInvoices } from "../../../lib/billing-api.js";
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

const PAYMENT_METHOD_LABELS: Record<StaffPaymentMethod, string> = {
  card: "Carte",
  transfer: "Virement",
  direct_debit: "Prélèvement",
  cash: "Espèces",
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

function paymentMethodsLabel(methods: StaffPaymentMethod[]): string {
  if (methods.length === 0) return "—";
  return methods.map((method) => PAYMENT_METHOD_LABELS[method]).join(", ");
}

const EMPTY_SUMMARY: StaffBillingInvoiceListSummary = {
  invoiceCount: 0,
  balanceDueCents: 0,
  paidTotalCents: 0,
};

export function InvoicesListPage() {
  const [invoices, setInvoices] = useState<StaffBillingInvoiceListItem[]>([]);
  const [summary, setSummary] = useState<StaffBillingInvoiceListSummary>(EMPTY_SUMMARY);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StaffInvoiceStatus | "">("");
  const [paymentMethod, setPaymentMethod] = useState<StaffPaymentMethod | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              {STATUS_LABELS[key]}
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
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.reference}</td>
                  <td>
                    <div>{invoice.clientLabel}</div>
                    {invoice.companyLegalName ? (
                      <div className={styles.muted}>{invoice.companyLegalName}</div>
                    ) : null}
                    {invoice.emails[0] ? (
                      <div className={styles.muted}>{invoice.emails[0]}</div>
                    ) : null}
                  </td>
                  <td>
                    <span className={styles.statusChip} data-status={invoice.status}>
                      {STATUS_LABELS[invoice.status]}
                    </span>
                  </td>
                  <td>{paymentMethodsLabel(invoice.paymentMethods)}</td>
                  <td>{formatEuroFromCents(invoice.totals.ttc)}</td>
                  <td>{formatEuroFromCents(invoice.totals.balanceDue)}</td>
                  <td>{formatDate(invoice.issuedAt ?? invoice.createdAt)}</td>
                  <td>
                    <a
                      className={styles.secondaryButton}
                      href={billingInvoicePdfUrl(invoice.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
