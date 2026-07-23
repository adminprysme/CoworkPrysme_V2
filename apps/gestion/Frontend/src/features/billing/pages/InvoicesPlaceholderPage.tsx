import { BillingStats } from "../components/BillingStats.js";
import styles from "../BillingPages.module.css";

const PLACEHOLDER_STATS = [
  {
    key: "total",
    label: "Factures",
    value: "0",
    accent: "var(--color-primary)",
  },
  {
    key: "due",
    label: "Total dû",
    value: "0,00 €",
    accent: "var(--color-accent, var(--color-primary))",
  },
  {
    key: "collected",
    label: "Encaissé (période)",
    value: "0,00 €",
    accent: "var(--color-secondary)",
  },
] as const;

export function InvoicesPlaceholderPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Factures</h1>
          <p className={styles.lead}>
            Liste et actions factures — chantier Facturation à venir. Les factures liées à un cardex
            restent consultables depuis le Planning (onglet Documents).
          </p>
        </div>
      </header>

      <BillingStats ariaLabel="Indicateurs factures" items={[...PLACEHOLDER_STATS]} />

      <p className={styles.emptyState}>Aucune facture à afficher pour le moment.</p>
    </div>
  );
}
