import { useRef, useState, type DragEvent } from "react";

import { DEFAULT_UPLOAD_MAX_BYTES_SERVICE } from "@coworkprysme/shared";

import { validatePhotoFile } from "../../spaces/utils/validation.js";
import styles from "./ServicePhotoField.module.css";

interface ServicePhotoFieldProps {
  serviceId?: string;
  photoUrl?: string;
  disabled?: boolean;
  compact?: boolean;
  pendingFile: File | null;
  removeRequested: boolean;
  onPendingFileChange: (file: File | null) => void;
  onRemoveRequestedChange: (remove: boolean) => void;
  onUploadNow?: (file: File) => Promise<void>;
  onDeleteNow?: () => Promise<void>;
}

function PhotoUploadIcon() {
  return (
    <svg className={styles.uploadIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="10.5" r="1.75" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6.5 16.5L10.2 12.8L13.1 15.7L16.4 12.4L18.5 14.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ServicePhotoField({
  serviceId,
  photoUrl,
  disabled = false,
  compact = false,
  pendingFile,
  removeRequested,
  onPendingFileChange,
  onRemoveRequestedChange,
  onUploadNow,
  onDeleteNow,
}: ServicePhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const previewUrl = pendingFile ? URL.createObjectURL(pendingFile) : photoUrl;
  const showPreview = Boolean(previewUrl) && !removeRequested;
  const uploadDisabled = disabled || busy || !serviceId;

  async function handleFile(file: File) {
    const validationError = validatePhotoFile(file, DEFAULT_UPLOAD_MAX_BYTES_SERVICE);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    onRemoveRequestedChange(false);

    if (serviceId && onUploadNow) {
      setBusy(true);
      try {
        await onUploadNow(file);
        onPendingFileChange(null);
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Upload impossible");
      } finally {
        setBusy(false);
      }
      return;
    }

    onPendingFileChange(file);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragActive(false);
    if (uploadDisabled) {
      return;
    }
    const file = event.dataTransfer.files.item(0);
    if (file) {
      void handleFile(file);
    }
  }

  async function handleRemove(event: React.MouseEvent) {
    event.stopPropagation();
    if (serviceId && onDeleteNow && photoUrl && !pendingFile) {
      setBusy(true);
      try {
        await onDeleteNow();
        onRemoveRequestedChange(false);
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Suppression impossible");
      } finally {
        setBusy(false);
      }
      return;
    }

    onPendingFileChange(null);
    onRemoveRequestedChange(true);
  }

  function openPicker() {
    if (!uploadDisabled) {
      inputRef.current?.click();
    }
  }

  return (
    <section
      className={[styles.section, compact ? styles.sectionCompact : ""].filter(Boolean).join(" ")}
    >
      <div className={styles.header}>
        <h3>Photo</h3>
        {!serviceId ? <p className={styles.hint}>Ajout possible après création.</p> : null}
      </div>

      <div
        className={[styles.content, compact ? styles.contentCompact : ""].filter(Boolean).join(" ")}
      >
        <div
          className={[
            styles.photoArea,
            dragActive ? styles.photoAreaActive : "",
            uploadDisabled ? styles.photoAreaDisabled : "",
            showPreview ? styles.photoAreaHasPreview : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role={uploadDisabled ? undefined : "button"}
          tabIndex={uploadDisabled ? undefined : 0}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (!uploadDisabled && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              openPicker();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!uploadDisabled) {
              setDragActive(true);
            }
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          {showPreview ? (
            <>
              <img className={styles.previewImage} src={previewUrl} alt="Photo du service" />
              <div className={styles.previewOverlay}>
                <p className={styles.overlayHint}>
                  {busy ? "Traitement…" : "Glisser-déposer ou cliquer pour remplacer"}
                </p>
                <div className={styles.overlayActions}>
                  <button
                    type="button"
                    className={styles.pickBtn}
                    disabled={uploadDisabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      openPicker();
                    }}
                  >
                    Parcourir
                  </button>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    disabled={uploadDisabled}
                    onClick={(event) => void handleRemove(event)}
                  >
                    Retirer
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <PhotoUploadIcon />
              <p className={styles.dropLabel}>
                {busy
                  ? "Traitement…"
                  : serviceId
                    ? "Glisser-déposer une image"
                    : "Photo après création"}
              </p>
              {serviceId ? (
                <button
                  type="button"
                  className={styles.pickBtn}
                  disabled={uploadDisabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    openPicker();
                  }}
                >
                  Parcourir
                </button>
              ) : null}
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            disabled={uploadDisabled}
            onChange={(event) => {
              const file = event.target.files?.item(0);
              if (file) {
                void handleFile(file);
              }
              event.target.value = "";
            }}
          />
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
    </section>
  );
}
