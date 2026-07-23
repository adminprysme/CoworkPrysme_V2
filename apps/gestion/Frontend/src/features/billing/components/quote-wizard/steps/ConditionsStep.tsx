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
      <h2 id="quote-conditions-title" className={styles.panelTitle}>
        Conditions
      </h2>

      <div className={pageStyles.fieldGrid}>
        <label className={pageStyles.label}>
          Mode de paiement préféré
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
          Situation de paiement
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
        <label className={pageStyles.label}>
          Valide jusqu’au *
          <input
            className={pageStyles.input}
            type="datetime-local"
            value={validUntilLocal}
            onChange={(event) => onChange({ validUntilLocal: event.target.value })}
          />
        </label>
        <label className={pageStyles.label}>
          Libellé conditions de paiement
          <input
            className={pageStyles.input}
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

      <label className={pageStyles.label}>
        Conditions publiques
        <textarea
          className={pageStyles.textarea}
          value={publicConditions}
          onChange={(event) => onChange({ publicConditions: event.target.value })}
        />
      </label>
      <label className={pageStyles.label}>
        Note interne
        <textarea
          className={pageStyles.textarea}
          value={internalNote}
          onChange={(event) => onChange({ internalNote: event.target.value })}
        />
      </label>
    </section>
  );
}
