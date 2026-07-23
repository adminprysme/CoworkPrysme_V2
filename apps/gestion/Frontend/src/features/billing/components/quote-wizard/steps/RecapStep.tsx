import type { StaffQuote, StaffQuoteLineInput } from "@coworkprysme/shared";
import { recomputeQuotePricing } from "@coworkprysme/shared";

import pageStyles from "../../../BillingPages.module.css";
import type { QuoteWizardState } from "../../../lib/quote-wizard-state.js";
import { formatEuroFromCents } from "../../../lib/quote-wizard-state.js";
import styles from "../QuoteWizard.module.css";

type RecapStepProps = {
  state: QuoteWizardState;
  lines: StaffQuoteLineInput[];
  lastSaved: StaffQuote | null;
  sending: boolean;
  onSaveDraft: () => void;
  onSend: () => void;
};

export function RecapStep({
  state,
  lines,
  lastSaved,
  sending,
  onSaveDraft,
  onSend,
}: RecapStepProps) {
  const priced = recomputeQuotePricing({
    lines,
    depositPercent: state.depositPercent,
  });
  const prospect = state.prospect;

  return (
    <section className={styles.panel} aria-labelledby="quote-recap-title">
      <h2 id="quote-recap-title" className={styles.panelTitle}>
        Récapitulatif
      </h2>

      <div className={styles.recapGrid}>
        <p className={styles.recapRow}>
          <span>Référence</span>
          <strong>{state.reference ?? lastSaved?.reference ?? "— (brouillon non créé)"}</strong>
        </p>
        <p className={styles.recapRow}>
          <span>Prospect</span>
          <strong>
            {[prospect.firstName, prospect.lastName].filter(Boolean).join(" ") ||
              prospect.displayName ||
              prospect.email ||
              "—"}
          </strong>
        </p>
        <p className={styles.recapRow}>
          <span>Email</span>
          <strong>{prospect.email || "—"}</strong>
        </p>
        <p className={styles.recapRow}>
          <span>Créneaux</span>
          <strong>{state.spaces.length}</strong>
        </p>
        <p className={styles.recapRow}>
          <span>Services</span>
          <strong>{state.services.length}</strong>
        </p>
        <p className={styles.recapRow}>
          <span>Paiement</span>
          <strong>{state.paymentMethodPreferred || "non précisé"}</strong>
        </p>
        <p className={styles.recapRow}>
          <span>Total TTC</span>
          <strong>{formatEuroFromCents(priced.totals.ttc)}</strong>
        </p>
        {state.depositPercent > 0 ? (
          <p className={styles.recapRow}>
            <span>Acompte TTC</span>
            <strong>{formatEuroFromCents(priced.deposit.depositAmountTTC)}</strong>
          </p>
        ) : null}
      </div>

      <div className={pageStyles.toolbar}>
        <button
          type="button"
          className={pageStyles.secondaryButton}
          disabled={sending}
          onClick={onSaveDraft}
        >
          Enregistrer le brouillon
        </button>
        <button
          type="button"
          className={pageStyles.primaryButton}
          disabled={sending}
          onClick={onSend}
        >
          {sending ? "Envoi…" : "Envoyer le devis"}
        </button>
      </div>
      <p className={pageStyles.muted}>
        L’envoi passe le devis en statut « envoyé », génère le token d’acceptation et tente l’email
        (PDF complet = chantier #7).
      </p>
    </section>
  );
}
