import { useCallback, useEffect, useState } from "react";

import type { DiscountCodeResponse, ServicePromoEligibility } from "@coworkprysme/shared";

import { StatusToggle } from "../../spaces/components/StatusToggle.js";
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

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        handleClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, submitting, handleClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

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
          <div className={styles.headerMain}>
            <h2 id="promo-form-title">
              {editing ? "Modifier le code promo" : "Nouveau code promo"}
            </h2>
            <div className={styles.headerActions}>
              <StatusToggle
                value={values.status === "active" ? "active" : "inactive"}
                onChange={(status) =>
                  setValues((current) => ({
                    ...current,
                    status: status === "active" ? "active" : "disabled",
                  }))
                }
                ariaLabel="Statut du code promo"
              />
              <button
                type="button"
                className={styles.closeBtn}
                onClick={handleClose}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
          </div>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formContent}>
            <PromoCodeForm
              values={values}
              errors={errors}
              services={services}
              onChange={setValues}
            />
            {submitError ? <p className={styles.submitError}>{submitError}</p> : null}
          </div>
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
