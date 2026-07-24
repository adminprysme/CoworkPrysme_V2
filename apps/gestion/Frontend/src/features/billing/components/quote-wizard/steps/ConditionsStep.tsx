import type { QuotePaymentMethod, QuotePaymentSituation } from "@coworkprysme/shared";

import pageStyles from "../../../BillingPages.module.css";
import styles from "../QuoteWizard.module.css";

type ConditionsStepProps = {
  paymentMethodPreferred: QuotePaymentMethod | "";
  paymentSituation: QuotePaymentSituation | "";
  validUntilLocal: string;
  internalNote: string;
  publicConditions: string;
  paymentTermsLabel: string;
  onChange: (patch: {
    paymentMethodPreferred?: QuotePaymentMethod | "";
    paymentSituation?: QuotePaymentSituation | "";
    validUntilLocal?: string;
    internalNote?: string;
    publicConditions?: string;
    paymentTermsLabel?: string;
  }) => void;
};

export function ConditionsStep({
  paymentMethodPreferred,
  paymentSituation,
  validUntilLocal,
  internalNote,
  publicConditions,
  paymentTermsLabel,
  onChange,
}: ConditionsStepProps) {
  return (
    <section className={styles.panel} aria-labelledby="quote-conditions-title">
      <header className={styles.stepHeader}>
        <div>
          <h2 id="quote-conditions-title" className={styles.panelTitle}>
            Conditions
          </h2>
        </div>
      </header>

      <div className={styles.conditionsLayout}>
        <div className={styles.sectionCard}>
          <h3 className={styles.sectionCardTitle}>Paiement</h3>
          <div className={styles.conditionsGrid}>
            <label className={pageStyles.label}>
              Mode préféré
              <select
                className={pageStyles.select}
                value={paymentMethodPreferred}
                onChange={(event) =>
                  onChange({
                    paymentMethodPreferred: event.target.value as QuotePaymentMethod | "",
                  })
                }
              >
                <option value="">Non précisé</option>
                <option value="card">Carte</option>
                <option value="bank_transfer">Virement</option>
                <option value="direct_debit">Prélèvement SEPA (stub — bientôt)</option>
              </select>
            </label>
            <label className={pageStyles.label}>
              Situation
              <select
                className={pageStyles.select}
                value={paymentSituation}
                onChange={(event) =>
                  onChange({
                    paymentSituation: event.target.value as QuotePaymentSituation | "",
                  })
                }
              >
                <option value="">Auto / non précisé</option>
                <option value="immediate">Immédiat</option>
                <option value="on_quote">Sur devis</option>
                <option value="deposit">Acompte</option>
                <option value="net_30">Net 30</option>
              </select>
            </label>
            <label className={`${pageStyles.label} ${styles.conditionsFull}`}>
              Libellé conditions de paiement
              <input
                className={pageStyles.input}
                placeholder="Ex. Acompte 30 % à l’acceptation, solde avant entrée"
                value={paymentTermsLabel}
                onChange={(event) => onChange({ paymentTermsLabel: event.target.value })}
              />
            </label>
          </div>
          {paymentMethodPreferred === "direct_debit" ? (
            <p className={pageStyles.hintNote}>
              Le prélèvement SEPA est un stub UI uniquement — pas d’intégration bancaire dans ce
              chantier.
            </p>
          ) : null}
        </div>

        <div className={styles.sectionCard}>
          <h3 className={styles.sectionCardTitle}>Validité</h3>
          <label className={pageStyles.label}>
            Valide jusqu’au *
            <input
              className={pageStyles.input}
              type="datetime-local"
              value={validUntilLocal}
              onChange={(event) => onChange({ validUntilLocal: event.target.value })}
            />
          </label>
          <p className={styles.fieldHint}>
            Après cette date, le devis ne pourra plus être accepté.
          </p>
        </div>

        <div className={`${styles.sectionCard} ${styles.conditionsFullSpan}`}>
          <h3 className={styles.sectionCardTitle}>Textes client</h3>
          <label className={pageStyles.label}>
            Conditions publiques
            <textarea
              className={`${pageStyles.textarea} ${styles.conditionsTextarea}`}
              rows={5}
              placeholder="Mentions visibles sur le devis PDF et l’email client…"
              value={publicConditions}
              onChange={(event) => onChange({ publicConditions: event.target.value })}
            />
          </label>
        </div>

        <div
          className={`${styles.sectionCard} ${styles.sectionCardInternal} ${styles.conditionsFullSpan}`}
        >
          <h3 className={styles.sectionCardTitle}>Note interne</h3>
          <p className={styles.internalBanner}>
            Réservée à l’équipe — exclue du PDF et de tout email client.
          </p>
          <label className={pageStyles.label}>
            <span className={styles.srOnly}>Note interne</span>
            <textarea
              className={`${pageStyles.textarea} ${styles.conditionsTextarea}`}
              rows={4}
              placeholder="Contexte commercial, rappel d’appel, points à surveiller…"
              value={internalNote}
              onChange={(event) => onChange({ internalNote: event.target.value })}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
