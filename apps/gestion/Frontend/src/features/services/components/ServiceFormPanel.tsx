import { useCallback, useEffect, useState } from "react";

import type { ServiceResponse } from "@coworkprysme/shared";

import {
  createEmptyServiceFormValues,
  serviceFormValuesToCreateRequest,
  serviceResponseToFormValues,
  validateServiceForm,
  hasServiceFormErrors,
  type ServiceFormErrors,
  type ServiceFormValues,
} from "../utils/validation.js";
import { ServiceForm } from "./ServiceForm.js";
import styles from "./ServiceFormPanel.module.css";

interface ServiceFormPanelProps {
  open: boolean;
  editing?: ServiceResponse;
  onClose: () => void;
  onSubmit: (values: ServiceFormValues, editing?: ServiceResponse) => Promise<void>;
}

export function ServiceFormPanel({ open, editing, onClose, onSubmit }: ServiceFormPanelProps) {
  const [values, setValues] = useState<ServiceFormValues>(createEmptyServiceFormValues());
  const [errors, setErrors] = useState<ServiceFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setValues(editing ? serviceResponseToFormValues(editing) : createEmptyServiceFormValues());
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
    const nextErrors = validateServiceForm(values);
    setErrors(nextErrors);
    if (hasServiceFormErrors(nextErrors)) {
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
        aria-labelledby="service-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.dialogAccent} aria-hidden="true" />
        <header className={styles.header}>
          <div>
            <h2 id="service-form-title">{editing ? "Modifier le service" : "Nouveau service"}</h2>
            <p className={styles.subtitle}>
              Catalogue réutilisable pour la vitrine, la facturation et le post-master.
            </p>
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
          <ServiceForm values={values} errors={errors} onChange={setValues} />
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
              {submitting ? "Enregistrement…" : editing ? "Enregistrer" : "Créer le service"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export { serviceFormValuesToCreateRequest };
