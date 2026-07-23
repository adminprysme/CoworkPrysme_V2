import type { StaffQuoteLineInput } from "@coworkprysme/shared";
import { recomputeQuotePricing } from "@coworkprysme/shared";

import pageStyles from "../../../BillingPages.module.css";
import type { WizardPricingOverride } from "../../../lib/quote-wizard-state.js";
import { formatEuroFromCents } from "../../../lib/quote-wizard-state.js";
import styles from "../QuoteWizard.module.css";

type PricingStepProps = {
  lines: StaffQuoteLineInput[];
  depositPercent: number;
  overrides: WizardPricingOverride[];
  onDepositChange: (value: number) => void;
  onOverridesChange: (next: WizardPricingOverride[]) => void;
};

export function PricingStep({
  lines,
  depositPercent,
  overrides,
  onDepositChange,
  onOverridesChange,
}: PricingStepProps) {
  const priced = recomputeQuotePricing({ lines, depositPercent });

  function setOverride(lineId: string, patch: Partial<WizardPricingOverride> | null) {
    const existing = overrides.find((item) => item.lineId === lineId);
    if (patch === null) {
      onOverridesChange(overrides.filter((item) => item.lineId !== lineId));
      return;
    }
    if (existing) {
      onOverridesChange(
        overrides.map((item) => (item.lineId === lineId ? { ...item, ...patch } : item)),
      );
      return;
    }
    const index = lines.findIndex((item) => item.lineId === lineId);
    const pricedLine = index >= 0 ? priced.lines[index] : undefined;
    onOverridesChange([
      ...overrides,
      {
        lineId,
        forcedUnitPriceHT: pricedLine?.unitPriceHT ?? 0,
        priceOverrideReason: "",
        ...patch,
      },
    ]);
  }

  return (
    <section className={styles.panel} aria-labelledby="quote-pricing-title">
      <h2 id="quote-pricing-title" className={styles.panelTitle}>
        Tarification
      </h2>
      <p className={pageStyles.muted}>
        Les paliers espace sont calculés côté client pour l’aperçu ; le serveur recalcule à
        l’enregistrement. Un override exige une justification.
      </p>

      {lines.length === 0 ? (
        <p className={pageStyles.muted}>Aucune ligne — ajoutez des espaces ou services.</p>
      ) : (
        <table className={styles.lineTable}>
          <thead>
            <tr>
              <th>Ligne</th>
              <th>PU HT</th>
              <th>Total TTC</th>
              <th>Override</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const pricedLine = priced.lines[index]!;
              const override = overrides.find((item) => item.lineId === line.lineId);
              return (
                <tr key={line.lineId}>
                  <td>
                    <div>{line.label}</div>
                    <div className={pageStyles.muted}>{line.kind}</div>
                  </td>
                  <td>{formatEuroFromCents(pricedLine.unitPriceHT)}</td>
                  <td>{formatEuroFromCents(pricedLine.totalTTC)}</td>
                  <td>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={Boolean(override)}
                        onChange={(event) => {
                          if (!event.target.checked) {
                            setOverride(line.lineId, null);
                            return;
                          }
                          setOverride(line.lineId, {
                            forcedUnitPriceHT: pricedLine.calculatedUnitPriceHT,
                            priceOverrideReason: "",
                          });
                        }}
                      />
                      Forcer
                    </label>
                    {override ? (
                      <div className={pageStyles.fieldGrid} style={{ marginTop: "0.45rem" }}>
                        <label className={pageStyles.label}>
                          PU HT (centimes)
                          <input
                            className={pageStyles.input}
                            type="number"
                            min={0}
                            value={override.forcedUnitPriceHT}
                            onChange={(event) =>
                              setOverride(line.lineId, {
                                forcedUnitPriceHT: Math.max(0, Number(event.target.value) || 0),
                              })
                            }
                          />
                        </label>
                        <label className={pageStyles.label}>
                          Justification *
                          <input
                            className={pageStyles.input}
                            value={override.priceOverrideReason}
                            onChange={(event) =>
                              setOverride(line.lineId, {
                                priceOverrideReason: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className={pageStyles.fieldGrid}>
        <label className={pageStyles.label}>
          Acompte (%)
          <input
            className={pageStyles.input}
            type="number"
            min={0}
            max={100}
            value={depositPercent}
            onChange={(event) =>
              onDepositChange(Math.min(100, Math.max(0, Number(event.target.value) || 0)))
            }
          />
        </label>
      </div>

      <div className={styles.recapGrid}>
        <p className={styles.recapRow}>
          <span>Total HT</span>
          <strong>{formatEuroFromCents(priced.totals.ht)}</strong>
        </p>
        <p className={styles.recapRow}>
          <span>TVA</span>
          <strong>{formatEuroFromCents(priced.totals.vat)}</strong>
        </p>
        <p className={styles.recapRow}>
          <span>Total TTC</span>
          <strong>{formatEuroFromCents(priced.totals.ttc)}</strong>
        </p>
        {depositPercent > 0 ? (
          <p className={styles.recapRow}>
            <span>Acompte TTC ({depositPercent} %)</span>
            <strong>{formatEuroFromCents(priced.deposit.depositAmountTTC)}</strong>
          </p>
        ) : null}
      </div>
    </section>
  );
}
