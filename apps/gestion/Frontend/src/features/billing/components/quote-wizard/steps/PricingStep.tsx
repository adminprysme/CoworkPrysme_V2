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
      <header className={styles.stepHeader}>
        <div>
          <h2 id="quote-pricing-title" className={styles.panelTitle}>
            Tarification
          </h2>
        </div>
      </header>

      {lines.length === 0 ? (
        <div className={styles.emptyPanel}>
          <p className={styles.emptyPanelTitle}>Aucune ligne tarifaire</p>
          <p className={pageStyles.muted}>Ajoutez d’abord des espaces ou des services.</p>
        </div>
      ) : (
        <div className={styles.pricingLines}>
          {lines.map((line, index) => {
            const pricedLine = priced.lines[index]!;
            const override = overrides.find((item) => item.lineId === line.lineId);
            const forced = Boolean(override);
            return (
              <article
                key={line.lineId}
                className={styles.pricingLineCard}
                data-forced={forced ? "true" : "false"}
              >
                <div className={styles.pricingLineTop}>
                  <div className={styles.pricingLineIdentity}>
                    <span className={styles.kindChip}>{kindLabel(line.kind)}</span>
                    <h3 className={styles.pricingLineTitle}>{line.label}</h3>
                    <p className={styles.pricingLineMeta}>
                      Qté {line.qty}
                      {line.vatRate !== undefined ? ` · TVA ${line.vatRate} %` : ""}
                    </p>
                  </div>
                  <div className={styles.pricingLineAmounts}>
                    <div>
                      <p className={styles.miniLabel}>PU HT</p>
                      <p className={styles.miniValue}>
                        {formatEuroFromCents(pricedLine.unitPriceHT)}
                      </p>
                    </div>
                    <div>
                      <p className={styles.miniLabel}>Total TTC</p>
                      <p className={styles.miniValueStrong}>
                        {formatEuroFromCents(pricedLine.totalTTC)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.pricingLineActions}>
                  <label className={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={forced}
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
                    <span className={styles.toggleUi} aria-hidden="true" />
                    <span>Changer le prix</span>
                  </label>
                  {forced && override ? (
                    <div className={styles.overridePanel}>
                      <label className={pageStyles.label}>
                        Prix unitaire HT (€)
                        <input
                          className={pageStyles.input}
                          type="number"
                          min={0}
                          step="0.01"
                          value={override.forcedUnitPriceHT / 100}
                          onChange={(event) =>
                            setOverride(line.lineId, {
                              forcedUnitPriceHT: Math.max(
                                0,
                                Math.round((Number(event.target.value) || 0) * 100),
                              ),
                            })
                          }
                        />
                      </label>
                      <label className={pageStyles.label}>
                        Justification *
                        <input
                          className={pageStyles.input}
                          placeholder="Motif commercial, geste client…"
                          value={override.priceOverrideReason}
                          onChange={(event) =>
                            setOverride(line.lineId, {
                              priceOverrideReason: event.target.value,
                            })
                          }
                        />
                      </label>
                      <p className={styles.overrideHint}>
                        Calculé : {formatEuroFromCents(pricedLine.calculatedUnitPriceHT)} HT
                      </p>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className={styles.sectionCard}>
        <h3 className={styles.sectionCardTitle}>Acompte</h3>
        <div className={styles.depositRow}>
          <label className={pageStyles.label}>
            Pourcentage d’acompte
            <div className={styles.depositControl}>
              <input
                className={`${pageStyles.input} ${styles.depositInput}`}
                type="number"
                min={0}
                max={100}
                value={depositPercent}
                onChange={(event) =>
                  onDepositChange(Math.min(100, Math.max(0, Number(event.target.value) || 0)))
                }
              />
              <span className={styles.depositSuffix}>%</span>
            </div>
          </label>
          {depositPercent > 0 ? (
            <p className={styles.depositHint}>
              Soit {formatEuroFromCents(priced.deposit.depositAmountTTC)} TTC à l’acceptation.
            </p>
          ) : null}
        </div>
      </div>

      <div className={styles.totalsStrip} aria-label="Totaux du devis">
        {(
          [
            ["HT", priced.totals.ht],
            ["TVA", priced.totals.vat],
            ["TTC", priced.totals.ttc],
            ...(depositPercent > 0 ? [["Acompte", priced.deposit.depositAmountTTC] as const] : []),
          ] as const
        ).map(([label, cents]) => (
          <div
            key={label}
            className={styles.totalCard}
            data-emphasis={label === "TTC" ? "true" : "false"}
          >
            <p className={styles.totalCardLabel}>{label}</p>
            <p className={styles.totalCardValue}>{formatEuroFromCents(cents)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
