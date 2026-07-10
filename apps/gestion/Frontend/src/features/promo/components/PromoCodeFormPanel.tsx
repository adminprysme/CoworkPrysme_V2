import { useCallback, useEffect, useState } from "react";

import type { DiscountCodeResponse, ServicePromoEligibility } from "@coworkprysme/shared";

import {
  createEmptyPromoCodeFormValues,
  discountCodeResponseToFormValues,
  promoCodeFormValuesToCreateRequest,
  validatePromoCodeForm,
  type PromoCodeFormErrors,
  type PromoCodeFormValues,
} from "../utils/validation.js";
import { PromoCodeForm } from "./PromoCodeForm.js";
import styles from "./PromoCodeFormPanel.module.css";

interface PromoCodeFormPanelProps {
  open: boolean;
  editing?: DiscountCodeResponse;
  services: ServicePromoEligibility[];
  onClose: () => void;
  onSubmit: (values: PromoCodeFormValues, editing?: DiscountCodeResponse) => Promise<void>;
}

export function PromoCodeFormPanel({
  open,
  editing,
  services,
  onClose,
  onSubmit,
}: PromoCodeFormPanelProps) {
  const [values, setValues] = useState<PromoCodeFormValues>(createEmptyPromoCodeFormValues());
  const [errors, setErrors] = useState<PromoCodeFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setValues(
      editing ? discountCodeResponseToFormValues(editing) : createEmptyPromoCodeFormValues(),
    );
    setErrors({});
    setSubmitError(null);
  }, [open, editing]);

  const handleClose = useCallback(() => {
    if (submitting) {
      return;
    }
    onClose();
  }, [onClose, submitting]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validatePromoCodeForm(values, services);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(values, editing);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.dialogAccent} aria-hidden="true" />
        <header className={styles.header}>
          <div>
            <h2 id="promo-form-title">
              {editing ? "Modifier le code promo" : "Nouveau code promo"}
            </h2>
            <p className={styles.subtitle}>Codes publics vitrine (kind: promo).</p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </header>

        <form className={styles.body} onSubmit={handleSubmit}>
          <PromoCodeForm values={values} errors={errors} services={services} onChange={setValues} />
          {submitError ? <p className={styles.submitError}>{submitError}</p> : null}
          <footer className={styles.footer}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleClose}
              disabled={submitting}
            >
              Annuler
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? "Enregistrement…" : editing ? "Enregistrer" : "Créer le code"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export { promoCodeFormValuesToCreateRequest };
