import type { SpaceTariffFormLine } from "../utils/space-tariffs.js";
import { formatTtcFromLine } from "../utils/space-tariffs.js";
import styles from "./SpaceTariffsEditor.module.css";

interface SpaceTariffsEditorProps {
  tariffs: SpaceTariffFormLine[];
  error?: string;
  onChange: (tariffs: SpaceTariffFormLine[]) => void;
}

export function SpaceTariffsEditor({ tariffs, error, onChange }: SpaceTariffsEditorProps) {
  function patchLine(
    durationClass: SpaceTariffFormLine["durationClass"],
    patch: Partial<SpaceTariffFormLine>,
  ) {
    onChange(
      tariffs.map((line) => (line.durationClass === durationClass ? { ...line, ...patch } : line)),
    );
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Tarifs</h3>
      <p className={styles.hint}>
        Activez les durées proposées pour cet espace. Les montants sont saisis en euros HT ; le TTC
        affiché est indicatif.
      </p>

      <div className={styles.table}>
        <div className={styles.headerRow} aria-hidden="true">
          <span>Durée</span>
          <span>Prix HT (€)</span>
          <span>TVA (%)</span>
          <span>TTC indicatif</span>
        </div>

        {tariffs.map((line) => (
          <div
            key={line.durationClass}
            className={[styles.row, !line.enabled ? styles.rowDisabled : ""]
              .filter(Boolean)
              .join(" ")}
          >
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={line.enabled}
                onChange={(event) =>
                  patchLine(line.durationClass, { enabled: event.target.checked })
                }
              />
              <span>{line.label}</span>
            </label>

            <label>
              <span className={styles.fieldLabel}>Prix HT (€)</span>
              <input
                className={styles.input}
                type="number"
                min={0}
                step={0.01}
                disabled={!line.enabled}
                value={line.enabled ? line.priceEuros : ""}
                placeholder={line.enabled ? "0.00" : "—"}
                onChange={(event) =>
                  patchLine(line.durationClass, {
                    priceEuros: Number.parseFloat(event.target.value) || 0,
                  })
                }
              />
            </label>

            <label>
              <span className={styles.fieldLabel}>TVA (%)</span>
              <input
                className={styles.input}
                type="number"
                min={0}
                step={0.1}
                disabled={!line.enabled}
                value={line.enabled ? line.vatRate : ""}
                placeholder={line.enabled ? "20" : "—"}
                onChange={(event) =>
                  patchLine(line.durationClass, {
                    vatRate: Number.parseFloat(event.target.value) || 0,
                  })
                }
              />
            </label>

            <span className={styles.ttc}>{formatTtcFromLine(line)}</span>
          </div>
        ))}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
    </section>
  );
}
