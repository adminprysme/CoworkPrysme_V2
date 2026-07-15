import type { ServiceFormErrors, ServiceFormValues } from "../utils/validation.js";
import styles from "./ServiceForm.module.css";

interface ServiceFormProps {
  values: ServiceFormValues;
  errors: ServiceFormErrors;
  onChange: (values: ServiceFormValues) => void;
  contentReadOnly?: boolean;
}

export function ServiceForm({
  values,
  errors,
  onChange,
  contentReadOnly = false,
}: ServiceFormProps) {
  function patch(patch: Partial<ServiceFormValues>) {
    onChange({ ...values, ...patch });
  }

  return (
    <div className={styles.form}>
      <label className={styles.field}>
        <span>Nom</span>
        <input
          className={styles.input}
          value={values.label}
          disabled={contentReadOnly}
          onChange={(event) => patch({ label: event.target.value })}
        />
        {errors.label ? <span className={styles.error}>{errors.label}</span> : null}
      </label>

      <label className={styles.field}>
        <span>Description courte</span>
        <textarea
          className={styles.textarea}
          rows={2}
          value={values.description}
          disabled={contentReadOnly}
          onChange={(event) => patch({ description: event.target.value })}
        />
        {errors.description ? <span className={styles.error}>{errors.description}</span> : null}
      </label>

      <div className={styles.row}>
        <label className={styles.field}>
          <span>Prix HT (€)</span>
          <input
            className={styles.input}
            type="number"
            min={0}
            step={0.01}
            value={values.priceEurosHT}
            onChange={(event) => patch({ priceEurosHT: event.target.value })}
          />
          {errors.priceEurosHT ? <span className={styles.error}>{errors.priceEurosHT}</span> : null}
        </label>

        <label className={styles.field}>
          <span>TVA (%)</span>
          <input
            className={styles.input}
            type="number"
            min={0}
            step={0.1}
            value={values.vatRate}
            onChange={(event) => patch({ vatRate: event.target.value })}
          />
          {errors.vatRate ? <span className={styles.error}>{errors.vatRate}</span> : null}
        </label>
      </div>

      <label className={styles.toggleField}>
        <input
          type="checkbox"
          checked={values.promoEligible}
          disabled={contentReadOnly}
          onChange={(event) => patch({ promoEligible: event.target.checked })}
        />
        <span>
          <strong>Éligible aux remises « 1 acheté = 1 offert »</strong>
        </span>
      </label>
    </div>
  );
}
