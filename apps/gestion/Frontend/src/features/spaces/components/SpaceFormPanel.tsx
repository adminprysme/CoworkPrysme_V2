import { useCallback, useEffect, useState } from "react";

import type { DaySchedule } from "../types.js";
import type { SpaceFormValues } from "../space-types.js";
import { revokePhotoUrls } from "../utils/photos.js";
import {
  createEmptySpaceFormValues,
  validateSpaceForm,
  type SpaceFormErrors,
} from "../utils/space-validation.js";
import { SpaceForm, type SpaceFormSection } from "./SpaceForm.js";
import { StatusToggle } from "./StatusToggle.js";
import styles from "./BuildingFormPanel.module.css";

type SpaceFormTab = SpaceFormSection;

const INFO_ERROR_KEYS = new Set<string>(["name", "floor", "capacity", "equipments", "photos"]);
const TARIFF_ERROR_KEYS = new Set<string>(["tariffs"]);

function tabForErrors(errors: SpaceFormErrors): SpaceFormTab {
  const keys = Object.keys(errors);
  if (keys.some((key) => TARIFF_ERROR_KEYS.has(key))) {
    return "tariffs";
  }
  if (keys.some((key) => INFO_ERROR_KEYS.has(key))) {
    return "info";
  }
  return "info";
}

interface SpaceFormPanelProps {
  open: boolean;
  mode?: "create" | "edit";
  title?: string;
  floorNames: string[];
  buildingHours: DaySchedule[];
  initialValues?: SpaceFormValues;
  onClose: () => void;
  onSubmit: (values: SpaceFormValues) => Promise<void>;
  onRemovePersistedPhoto?: (storageKey: string) => Promise<void>;
}

export function SpaceFormPanel({
  open,
  mode = "create",
  title,
  floorNames,
  buildingHours,
  initialValues,
  onClose,
  onSubmit,
  onRemovePersistedPhoto,
}: SpaceFormPanelProps) {
  const [tab, setTab] = useState<SpaceFormTab>("info");
  const [values, setValues] = useState<SpaceFormValues>(
    () => initialValues ?? createEmptySpaceFormValues(floorNames, buildingHours),
  );
  const [errors, setErrors] = useState<SpaceFormErrors>({});
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
    setValues(initialValues ?? createEmptySpaceFormValues(floorNames, buildingHours));
    setErrors({});
    setSubmitError(null);
  }, [open, floorNames, buildingHours, initialValues]);

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
    const nextErrors = validateSpaceForm(values);
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
    } catch {
      setSubmitError("Enregistrement impossible. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  const dialogTitle = title ?? (mode === "edit" ? "Modifier l'espace" : "Nouvel espace");
  const dialogSubtitle =
    mode === "edit"
      ? "Mettez à jour les informations, l'accessibilité et les tarifs."
      : "Créez un espace et configurez ses horaires et tarifs.";
  const submitLabel = mode === "edit" ? "Enregistrer" : "Créer l'espace";

  return (
    <div className={styles.overlay} role="presentation" onClick={handleClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="space-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.dialogAccent} aria-hidden="true" />

        <header className={styles.header}>
          <div className={styles.headerMain}>
            <h2 id="space-form-title">{dialogTitle}</h2>
            <p className={styles.headerSubtitle}>{dialogSubtitle}</p>
          </div>
          <div className={styles.headerActions}>
            <StatusToggle
              value={values.status}
              ariaLabel="Statut de l'espace"
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
          <button
            type="button"
            role="tab"
            aria-selected={tab === "tariffs"}
            className={[styles.tab, tab === "tariffs" ? styles.tabActive : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setTab("tariffs")}
          >
            Tarifs
          </button>
        </div>

        <div className={styles.body} role="tabpanel">
          <SpaceForm
            idPrefix={mode === "edit" ? "edit-space" : "create-space"}
            section={tab}
            values={values}
            errors={errors}
            floorNames={floorNames}
            buildingHours={buildingHours}
            onChange={setValues}
            onRemovePersistedPhoto={onRemovePersistedPhoto}
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
            {submitting ? "Enregistrement…" : submitLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
