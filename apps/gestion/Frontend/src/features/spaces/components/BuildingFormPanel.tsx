import { useCallback, useEffect, useState } from "react";

import { mapBuildingSaveError } from "../../../lib/building-save-errors.js";
import { revokePhotoUrls } from "../utils/photos.js";
import type { BuildingFormValues } from "../types.js";
import { createDefaultDaySchedules, createFloors } from "../utils/schedule.js";
import {
  createEmptyFormValues,
  validateBuildingForm,
  type BuildingFormErrors,
} from "../utils/validation.js";
import { BuildingForm } from "./BuildingForm.js";
import { StatusToggle } from "./StatusToggle.js";
import styles from "./BuildingFormPanel.module.css";

type CreateTab = "info" | "accessibility";

const INFO_ERROR_KEYS = new Set<string>([
  "name",
  "description",
  "floors",
  "conciergeLink",
  "photos",
]);

const ACCESSIBILITY_ERROR_KEYS = new Set<string>([
  "street",
  "postalCode",
  "city",
  "country",
  "coordinates",
]);

function tabForErrors(errors: BuildingFormErrors): CreateTab {
  const keys = Object.keys(errors) as (keyof BuildingFormErrors)[];
  if (keys.some((key) => ACCESSIBILITY_ERROR_KEYS.has(key))) {
    return "accessibility";
  }
  if (keys.some((key) => INFO_ERROR_KEYS.has(key))) {
    return "info";
  }
  return "info";
}

interface BuildingFormPanelProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: BuildingFormValues) => Promise<void>;
}

export function BuildingFormPanel({ open, onClose, onSubmit }: BuildingFormPanelProps) {
  const [tab, setTab] = useState<CreateTab>("info");
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
    setTab("info");
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

  async function handleSubmit() {
    const nextErrors = validateBuildingForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setTab(tabForErrors(nextErrors));
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(values);
      revokePhotoUrls(values.photos);
      onClose();
    } catch (error) {
      const mapped = mapBuildingSaveError(error);
      setErrors(mapped);
      setTab(tabForErrors(mapped));
      setSubmitError(
        mapped.photos ??
          mapped.coordinates ??
          "Impossible de créer le bâtiment. Vérifiez l'adresse et réessayez.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={handleClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="building-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.dialogAccent} aria-hidden="true" />

        <header className={styles.header}>
          <div className={styles.headerMain}>
            <h2 id="building-form-title">Nouveau bâtiment</h2>
            <p className={styles.headerSubtitle}>
              Créez un bâtiment et configurez son accessibilité.
            </p>
          </div>
          <div className={styles.headerActions}>
            <StatusToggle
              value={values.status}
              ariaLabel="Statut du bâtiment"
              onChange={(status) => setValues({ ...values, status })}
            />
            <button
              type="button"
              className={styles.closeBtn}
              onClick={handleClose}
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="Sections du formulaire">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "info"}
            className={[styles.tab, tab === "info" ? styles.tabActive : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setTab("info")}
          >
            Informations
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "accessibility"}
            className={[styles.tab, tab === "accessibility" ? styles.tabActive : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setTab("accessibility")}
          >
            Accessibilité
          </button>
        </div>

        <div className={styles.body} role="tabpanel">
          <BuildingForm
            idPrefix="create-building"
            section={tab}
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
            {submitting ? "Enregistrement…" : "Créer le bâtiment"}
          </button>
        </footer>
      </div>
    </div>
  );
}
