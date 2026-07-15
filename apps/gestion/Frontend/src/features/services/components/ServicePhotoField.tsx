import { useRef, useState, type DragEvent } from "react";

import { DEFAULT_UPLOAD_MAX_BYTES_SERVICE } from "@coworkprysme/shared";

import { validatePhotoFile } from "../../spaces/utils/validation.js";
import styles from "./ServicePhotoField.module.css";

interface ServicePhotoFieldProps {
  serviceId?: string;
  photoUrl?: string;
  disabled?: boolean;
  pendingFile: File | null;
  removeRequested: boolean;
  onPendingFileChange: (file: File | null) => void;
  onRemoveRequestedChange: (remove: boolean) => void;
  onUploadNow?: (file: File) => Promise<void>;
  onDeleteNow?: () => Promise<void>;
}

export function ServicePhotoField({
  serviceId,
  photoUrl,
  disabled = false,
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
    if (disabled || busy) {
      return;
    }
    const file = event.dataTransfer.files.item(0);
    if (file) {
      void handleFile(file);
    }
  }

  async function handleRemove() {
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

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h3>Photo du service</h3>
        {!serviceId ? (
          <p className={styles.hint}>La photo pourra être ajoutée après la création du service.</p>
        ) : null}
      </div>

      {showPreview ? (
        <div className={styles.previewWrap}>
          <img className={styles.preview} src={previewUrl} alt="Photo du service" />
        </div>
      ) : null}

      <div
        className={[
          styles.dropzone,
          dragActive ? styles.dropzoneActive : "",
          disabled ? styles.disabled : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !busy) {
            setDragActive(true);
          }
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
      >
        <p>{busy ? "Traitement…" : "Glissez une image ou"}</p>
        <button
          type="button"
          className={styles.pickBtn}
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          Choisir un fichier
        </button>
        <p className={styles.limit}>JPEG, PNG ou WebP — max 15 Mo</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          disabled={disabled || busy}
          onChange={(event) => {
            const file = event.target.files?.item(0);
            if (file) {
              void handleFile(file);
            }
            event.target.value = "";
          }}
        />
      </div>

      {showPreview ? (
        <button
          type="button"
          className={styles.removeBtn}
          disabled={disabled || busy}
          onClick={() => void handleRemove()}
        >
          Supprimer la photo
        </button>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </section>
  );
}
