import type { PromoCodeFormErrors, PromoCodeFormValues } from "../utils/validation.js";
import type { ServicePromoEligibility } from "@coworkprysme/shared";

import { PromoPerimeterSection } from "./PromoPerimeterSection.js";
import styles from "./PromoCodeForm.module.css";

interface PromoCodeFormProps {
  values: PromoCodeFormValues;
  errors: PromoCodeFormErrors;
  services: ServicePromoEligibility[];
  onChange: (values: PromoCodeFormValues) => void;
}

const DISCOUNT_TYPE_OPTIONS = [
  { value: "percentage", label: "Pourcentage" },
  { value: "fixed_amount", label: "Montant fixe" },
  { value: "buy_one_get_one", label: "1 acheté = 1 offert" },
] as const;

export function PromoCodeForm({ values, errors, services, onChange }: PromoCodeFormProps) {
  function patch(patch: Partial<PromoCodeFormValues>) {
    onChange({ ...values, ...patch });
  }

  return (
    <div className={styles.form}>
      <label className={styles.field}>
        <span>Code promo</span>
        <input
          className={styles.input}
          value={values.code}
          onChange={(event) => patch({ code: event.target.value.toUpperCase() })}
          placeholder="EX: WELCOME20"
        />
        {errors.code ? <span className={styles.error}>{errors.code}</span> : null}
      </label>

      <div className={styles.row}>
        <label className={styles.field}>
          <span>Type de remise</span>
          <select
            className={styles.input}
            value={values.discountType}
            onChange={(event) => {
              const discountType = event.target.value as PromoCodeFormValues["discountType"];
              patch({
                discountType,
                appliesTo: discountType === "buy_one_get_one" ? "service" : values.appliesTo,
              });
            }}
          >
            {DISCOUNT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {values.discountType === "percentage" ? (
          <label className={styles.field}>
            <span>Valeur (%)</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={values.valuePercent}
              onChange={(event) => patch({ valuePercent: event.target.value })}
            />
            {errors.valuePercent ? (
              <span className={styles.error}>{errors.valuePercent}</span>
            ) : null}
          </label>
        ) : values.discountType === "fixed_amount" ? (
          <label className={styles.field}>
            <span>Valeur (€)</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step={0.01}
              value={values.valueEuros}
              onChange={(event) => patch({ valueEuros: event.target.value })}
            />
            {errors.valueEuros ? <span className={styles.error}>{errors.valueEuros}</span> : null}
          </label>
        ) : (
          <div className={styles.field}>
            <span>Valeur</span>
            <p className={styles.bogoHint}>Inclus dans le type de remise</p>
          </div>
        )}
      </div>

      <PromoPerimeterSection
        values={values}
        services={services}
        appliesToError={errors.appliesTo}
        serviceKeysError={errors.serviceKeys}
        onChange={(next) => patch(next)}
      />

      <label className={styles.toggleField}>
        <input
          type="checkbox"
          checked={values.stackable}
          onChange={(event) => patch({ stackable: event.target.checked })}
        />
        <span>Cumulable avec d&apos;autres codes promo</span>
      </label>

      <div className={styles.row}>
        <label className={styles.field}>
          <span>Date de début (optionnel)</span>
          <input
            className={styles.input}
            type="datetime-local"
            value={values.startsAt}
            onChange={(event) => patch({ startsAt: event.target.value })}
          />
          {errors.startsAt ? <span className={styles.error}>{errors.startsAt}</span> : null}
        </label>

        <label className={styles.field}>
          <span>Date d&apos;expiration</span>
          <input
            className={styles.input}
            type="datetime-local"
            value={values.expiresAt}
            onChange={(event) => patch({ expiresAt: event.target.value })}
          />
          {errors.expiresAt ? <span className={styles.error}>{errors.expiresAt}</span> : null}
        </label>
      </div>

      <label className={styles.field}>
        <span>Quota d&apos;utilisation (optionnel)</span>
        <input
          className={styles.input}
          type="number"
          min={1}
          step={1}
          placeholder="Illimité"
          value={values.maxUses}
          onChange={(event) => patch({ maxUses: event.target.value })}
        />
        {errors.maxUses ? <span className={styles.error}>{errors.maxUses}</span> : null}
      </label>
    </div>
  );
}
