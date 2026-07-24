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
  onSend: () => void;
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: "Carte",
  bank_transfer: "Virement",
  direct_debit: "Prélèvement SEPA",
};

const PAYMENT_SITUATION_LABELS: Record<string, string> = {
  immediate: "Immédiat",
  on_quote: "Sur devis",
  deposit: "Acompte",
  net_30: "Net 30 jours",
};

function kindLabel(kind: StaffQuoteLineInput["kind"]): string {
  switch (kind) {
    case "space":
      return "Espace";
    case "service":
      return "Service";
    case "fee":
      return "Frais";
    case "discount":
      return "Remise";
    default:
      return "Autre";
  }
}

function formatValidUntil(local: string): string {
  if (!local) return "—";
  try {
    const date = new Date(local);
    if (Number.isNaN(date.getTime())) return local;
    return date.toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  } catch {
    return local;
  }
}

export function RecapStep({ state, lines, lastSaved, sending, onSend }: RecapStepProps) {
  const priced = recomputeQuotePricing({
    lines,
    depositPercent: state.depositPercent,
  });
  const prospect = state.prospect;
  const reference = state.reference ?? lastSaved?.reference ?? null;
  const isExistingClient = Boolean(state.cardexId && state.clientAccountId);
  const contactName =
    [prospect.firstName, prospect.lastName].filter(Boolean).join(" ") ||
    prospect.displayName ||
    null;
  const companyName =
    prospect.clientKind === "company" ? prospect.companyName?.trim() || null : null;

  return (
    <section className={styles.panel} aria-labelledby="quote-recap-title">
      <header className={styles.stepHeader}>
        <div>
          <h2 id="quote-recap-title" className={styles.panelTitle}>
            Récapitulatif
          </h2>
          <p className={styles.stepLead}>
            Vérifiez le devis avant envoi. L’envoi génère le lien d’acceptation et notifie le
            client.
          </p>
        </div>
      </header>

      <div className={styles.recapHero} aria-label="Totaux et validité">
        <div className={styles.recapHeroMetric} data-emphasis="true">
          <p className={styles.recapHeroEyebrow}>Total TTC</p>
          <p className={styles.recapHeroAmount}>{formatEuroFromCents(priced.totals.ttc)}</p>
          {state.depositPercent > 0 ? (
            <p className={styles.recapHeroSub}>
              Acompte {state.depositPercent} % ·{" "}
              {formatEuroFromCents(priced.deposit.depositAmountTTC)} TTC
            </p>
          ) : null}
        </div>
        <div className={styles.recapHeroMetric}>
          <p className={styles.recapHeroEyebrow}>TVA</p>
          <p className={styles.recapHeroValue}>{formatEuroFromCents(priced.totals.vat)}</p>
        </div>
        <div className={styles.recapHeroMetric}>
          <p className={styles.recapHeroEyebrow}>HT</p>
          <p className={styles.recapHeroValue}>{formatEuroFromCents(priced.totals.ht)}</p>
        </div>
        <div className={styles.recapHeroMetric}>
          <p className={styles.recapHeroEyebrow}>Réf. / Validité</p>
          <p className={styles.recapMetaValue}>{reference ?? "Brouillon non créé"}</p>
          <p className={styles.recapHeroSub}>{formatValidUntil(state.validUntilLocal)}</p>
        </div>
      </div>

      <div className={styles.recapSections}>
        <article className={styles.sectionCard}>
          <h3 className={styles.sectionCardTitle}>Client</h3>
          <dl className={styles.recapFacts}>
            <div>
              <dt>Type</dt>
              <dd>{isExistingClient ? "Dossier existant" : "Nouveau prospect"}</dd>
            </div>
            {companyName ? (
              <div>
                <dt>Entreprise</dt>
                <dd>{companyName}</dd>
              </div>
            ) : null}
            <div>
              <dt>Contact</dt>
              <dd>{contactName ?? (isExistingClient ? "Compte lié" : "—")}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{state.cardexId && !prospect.email ? "Compte lié" : prospect.email || "—"}</dd>
            </div>
          </dl>
        </article>

        <article className={styles.sectionCard}>
          <h3 className={styles.sectionCardTitle}>Contenu</h3>
          <div className={styles.recapCounts}>
            <div className={styles.recapCount}>
              <strong>{state.spaces.length}</strong>
              <span>espace{state.spaces.length === 1 ? "" : "s"}</span>
            </div>
            <div className={styles.recapCount}>
              <strong>{state.services.length}</strong>
              <span>service{state.services.length === 1 ? "" : "s"}</span>
            </div>
            <div className={styles.recapCount}>
              <strong>{lines.length}</strong>
              <span>ligne{lines.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          {lines.length > 0 ? (
            <ul className={styles.recapLineList}>
              {lines.map((line, index) => {
                const pricedLine = priced.lines[index];
                return (
                  <li key={line.lineId} className={styles.recapLineItem}>
                    <div>
                      <span className={styles.kindChip}>{kindLabel(line.kind)}</span>
                      <strong className={styles.recapLineLabel}>{line.label}</strong>
                    </div>
                    <span className={styles.recapLineAmount}>
                      {pricedLine ? formatEuroFromCents(pricedLine.totalTTC) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={pageStyles.muted}>Aucune ligne.</p>
          )}
        </article>

        <article className={styles.sectionCard}>
          <h3 className={styles.sectionCardTitle}>Conditions</h3>
          <dl className={styles.recapFacts}>
            <div>
              <dt>Paiement</dt>
              <dd>
                {state.paymentMethodPreferred
                  ? (PAYMENT_METHOD_LABELS[state.paymentMethodPreferred] ??
                    state.paymentMethodPreferred)
                  : "Non précisé"}
              </dd>
            </div>
            <div>
              <dt>Situation</dt>
              <dd>
                {state.paymentSituation
                  ? (PAYMENT_SITUATION_LABELS[state.paymentSituation] ?? state.paymentSituation)
                  : "Auto / non précisé"}
              </dd>
            </div>
            <div>
              <dt>Libellé</dt>
              <dd>{state.paymentTermsLabel.trim() || "—"}</dd>
            </div>
            <div>
              <dt>Conditions publiques</dt>
              <dd className={styles.recapMultiline}>{state.publicConditions.trim() || "—"}</dd>
            </div>
          </dl>
        </article>
      </div>

      <div className={styles.recapSendBar}>
        <div>
          <p className={styles.recapSendTitle}>Prêt à envoyer ?</p>
          <p className={pageStyles.muted}>
            Le devis passe en « Envoyé », et envoi du mail client (PDF en pièce jointe).
          </p>
        </div>
        <button
          type="button"
          className={pageStyles.primaryButton}
          disabled={sending}
          onClick={onSend}
        >
          {sending ? "Envoi…" : "Envoyer le devis"}
        </button>
      </div>
    </section>
  );
}
