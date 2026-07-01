import { useCallback, useEffect, useState } from "react";

import type { DaySchedule } from "../types.js";
import type { SpaceFormValues } from "../space-types.js";
import { revokePhotoUrls } from "../utils/photos.js";
import {
  createEmptySpaceFormValues,
  validateSpaceForm,
  type SpaceFormErrors,
} from "../utils/space-validation.js";
import { SpaceForm } from "./SpaceForm.js";
import panelStyles from "./BuildingFormPanel.module.css";

interface SpaceFormPanelProps {
  open: boolean;
  floorNames: string[];
  buildingHours: DaySchedule[];
  onClose: () => void;
  onSubmit: (values: SpaceFormValues) => Promise<void>;
}

export function SpaceFormPanel({
  open,
  floorNames,
  buildingHours,
  onClose,
  onSubmit,
}: SpaceFormPanelProps) {
  const [values, setValues] = useState<SpaceFormValues>(() =>
    createEmptySpaceFormValues(floorNames, buildingHours),
  );
  const [errors, setErrors] = useState<SpaceFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    revokePhotoUrls(values.photos);
    onClose();
  }, [onClose, values.photos]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setValues(createEmptySpaceFormValues(floorNames, buildingHours));
    setErrors({});
  }, [open, floorNames, buildingHours]);

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
    const nextErrors = validateSpaceForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(values);
      revokePhotoUrls(values.photos);
      onClose();
    } catch {
      setErrors({ name: "Enregistrement impossible. Réessayez." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={panelStyles.overlay} role="presentation" onClick={handleClose}>
      <aside
        className={panelStyles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="space-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={panelStyles.header}>
          <h2 id="space-form-title">Nouvel espace</h2>
          <button
            type="button"
            className={panelStyles.closeBtn}
            onClick={handleClose}
            aria-label="Fermer"
          >
            ✕
          </button>
        </header>

        <div className={panelStyles.body}>
          <SpaceForm
            idPrefix="create-space"
            values={values}
            errors={errors}
            floorNames={floorNames}
            buildingHours={buildingHours}
            onChange={setValues}
          />
        </div>

        <footer className={panelStyles.footer}>
          <button type="button" className={panelStyles.secondaryBtn} onClick={handleClose}>
            Annuler
          </button>
          <button
            type="button"
            className={panelStyles.primaryBtn}
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Enregistrement…" : "Enregistrer"}
          </button>
        </footer>
      </aside>
    </div>
  );
}
