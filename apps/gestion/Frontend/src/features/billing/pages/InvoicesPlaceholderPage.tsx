import styles from "../BillingPages.module.css";

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
    </div>
  );
}
