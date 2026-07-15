import { useCallback, useEffect, useMemo, useState } from "react";

import type { ServiceResponse } from "@coworkprysme/shared";
import { getServiceEditMode } from "@coworkprysme/shared";

import { useAuth } from "../../../app/AuthProvider.js";
import {
  deleteServicePhoto,
  servicePhotoUrl,
  uploadServicePhoto,
} from "../../../lib/services-api.js";
import {
  createEmptyServiceFormValues,
  serviceFormValuesToCreateRequest,
  serviceResponseToFormValues,
  validateServiceForm,
  hasServiceFormErrors,
  type ServiceFormErrors,
  type ServiceFormValues,
} from "../utils/validation.js";
import {
  ServiceAvailabilitySection,
  createDefaultAvailability,
} from "./ServiceAvailabilitySection.js";
import { ServiceForm } from "./ServiceForm.js";
import { ServicePhotoField } from "./ServicePhotoField.js";
import styles from "./ServiceFormPanel.module.css";

interface ServiceFormPanelProps {
  open: boolean;
  editing?: ServiceResponse;
  onClose: () => void;
  onSubmit: (
    values: ServiceFormValues,
    editing: ServiceResponse | undefined,
    options: {
      pendingPhoto: File | null;
      removePhoto: boolean;
      onPhotoUploaded: (service: ServiceResponse) => void;
    },
  ) => Promise<void>;
}

export function ServiceFormPanel({ open, editing, onClose, onSubmit }: ServiceFormPanelProps) {
  const { user } = useAuth();
  const isAdmin = user?.profile.role === "admin";

  const [values, setValues] = useState<ServiceFormValues>(createEmptyServiceFormValues(isAdmin));
  const [errors, setErrors] = useState<ServiceFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [liveEditing, setLiveEditing] = useState<ServiceResponse | undefined>(editing);

  const editMode = useMemo(() => {
    if (!user || !liveEditing) {
      return "all" as const;
    }
    return getServiceEditMode(
      {
        role: user.profile.role,
        scopeBuildingIds: user.profile.scope.buildingIds,
      },
      {
        id: liveEditing.id,
        isGlobal: liveEditing.isGlobal,
        buildingIds: liveEditing.buildingIds,
      },
    );
  }, [liveEditing, user]);

  const contentReadOnly = editMode === "price_only";
  const availabilityReadOnly = contentReadOnly;

  useEffect(() => {
    if (!open) {
      return;
    }
    setLiveEditing(editing);
    setValues(
      editing ? serviceResponseToFormValues(editing) : createEmptyServiceFormValues(isAdmin),
    );
    setErrors({});
    setSubmitError(null);
    setPendingPhoto(null);
    setRemovePhoto(false);
  }, [open, editing, isAdmin]);

  const handleClose = useCallback(() => {
    if (submitting) {
      return;
    }
    onClose();
  }, [onClose, submitting]);

  if (!open || !user) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validateServiceForm(values, {
      skipAvailability: availabilityReadOnly,
    });
    setErrors(nextErrors);
    if (hasServiceFormErrors(nextErrors)) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(values, liveEditing, {
        pendingPhoto,
        removePhoto,
        onPhotoUploaded: setLiveEditing,
      });
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setSubmitting(false);
    }
  }

  const photoUrl =
    liveEditing?.photo?.url && !removePhoto ? servicePhotoUrl(liveEditing.photo.url) : undefined;

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
            <h2 id="service-form-title">
              {liveEditing ? "Modifier le service" : "Nouveau service"}
            </h2>
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
          <ServiceForm
            values={values}
            errors={errors}
            onChange={setValues}
            contentReadOnly={contentReadOnly}
          />

          <ServiceAvailabilitySection
            value={{
              isGlobal: values.isGlobal,
              buildingIds: values.buildingIds,
            }}
            onChange={(availability) =>
              setValues((current) => ({
                ...current,
                isGlobal: availability.isGlobal,
                buildingIds: availability.buildingIds,
              }))
            }
            user={user}
            editing={liveEditing}
            readOnly={availabilityReadOnly}
          />
          {errors.buildingIds ? <p className={styles.submitError}>{errors.buildingIds}</p> : null}

          <ServicePhotoField
            serviceId={liveEditing?.id}
            photoUrl={photoUrl}
            disabled={contentReadOnly}
            pendingFile={pendingPhoto}
            removeRequested={removePhoto}
            onPendingFileChange={setPendingPhoto}
            onRemoveRequestedChange={setRemovePhoto}
            onUploadNow={
              liveEditing
                ? async (file) => {
                    const updated = await uploadServicePhoto(liveEditing.id, file);
                    setLiveEditing(updated);
                  }
                : undefined
            }
            onDeleteNow={
              liveEditing
                ? async () => {
                    const updated = await deleteServicePhoto(liveEditing.id);
                    setLiveEditing(updated);
                  }
                : undefined
            }
          />

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
              {submitting ? "Enregistrement…" : liveEditing ? "Enregistrer" : "Créer le service"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export { serviceFormValuesToCreateRequest, createDefaultAvailability };
