import { useCallback, useEffect, useState } from "react";

import { revokePhotoUrls } from "../utils/photos.js";
import type { BuildingFormValues } from "../types.js";
import { createDefaultDaySchedules, createFloors } from "../utils/schedule.js";
import {
  createEmptyFormValues,
  validateBuildingForm,
  type BuildingFormErrors,
} from "../utils/validation.js";
import { BuildingForm } from "./BuildingForm.js";
import styles from "./BuildingFormPanel.module.css";

interface BuildingFormPanelProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: BuildingFormValues) => Promise<void>;
}

export function BuildingFormPanel({ open, onClose, onSubmit }: BuildingFormPanelProps) {
  const [values, setValues] = useState<BuildingFormValues>(() => ({
    ...createEmptyFormValues(),
    accessibilityHours: createDefaultDaySchedules(),
    receptionHours: createDefaultDaySchedules(),
    floors: createFloors(1),
  }));
  const [errors, setErrors] = useState<BuildingFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    revokePhotoUrls(values.photos);
    onClose();
  }, [onClose, values.photos]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setValues({
      ...createEmptyFormValues(),
      accessibilityHours: createDefaultDaySchedules(),
      receptionHours: createDefaultDaySchedules(),
      floors: createFloors(1),
    });
    setErrors({});
    setSubmitError(null);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  if (!open) {
    return null;
  }

  async function handleSubmit() {
    const nextErrors = validateBuildingForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(values);
      revokePhotoUrls(values.photos);
      onClose();
    } catch {
      setSubmitError("Impossible de créer le bâtiment. Vérifiez l'adresse et réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={handleClose}>
      <aside
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="building-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id="building-form-title">Nouveau bâtiment</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Fermer"
          >
            ✕
          </button>
        </header>

        <div className={styles.body}>
          <BuildingForm
            idPrefix="create-building"
            values={values}
            errors={errors}
            onChange={setValues}
          />
          {submitError ? <p className={styles.submitError}>{submitError}</p> : null}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.secondaryBtn} onClick={handleClose}>
            Annuler
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "Enregistrement…" : "Enregistrer"}
          </button>
        </footer>
      </aside>
    </div>
  );
}
