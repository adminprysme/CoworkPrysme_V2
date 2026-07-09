import { useRef, useState, type DragEvent } from "react";

import { VITRINE_UPLOAD_MAX_BYTES } from "@coworkprysme/shared";

import { validatePhotoFile } from "../../features/spaces/utils/validation.js";
import { getVitrineImageFilename } from "../../lib/vitrine-content-api.js";
import styles from "./VitrineImageField.module.css";

interface VitrineImageFieldProps {
  title: string;
  description: string;
  images: string[];
  multiple?: boolean;
  maxImages?: number;
  uploading?: boolean;
  emptyMessage?: string;
  replaceLabel?: string;
  onUpload: (files: FileList) => void;
  onDelete: (storageKey: string) => void;
  getPreviewUrl: (storageKey: string) => string;
}

export function VitrineImageField({
  title,
  description,
  images,
  multiple = false,
  maxImages,
  uploading = false,
  emptyMessage = "Aucune image personnalisée — le site affiche l'image par défaut.",
  replaceLabel = "Remplacer l'image",
  onUpload,
  onDelete,
  getPreviewUrl,
}: VitrineImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atCapacity = maxImages !== undefined && images.length >= maxImages;
  const dropzoneDisabled = uploading || atCapacity;
  const showDropzone = multiple || images.length === 0 || !atCapacity;
  const dropzoneTitle =
    images.length === 0
      ? "Glissez-déposez une photo ici"
      : multiple
        ? "Ajouter une photo"
        : replaceLabel;

  function addFiles(fileList: FileList | null) {
    if (!fileList || dropzoneDisabled) {
      return;
    }

    let nextError: string | null = null;
    const files = Array.from(fileList);

    if (!multiple && files.length > 1) {
      nextError = "Une seule image à la fois pour cet emplacement.";
    }

    for (const file of files.slice(0, multiple ? undefined : 1)) {
      const validationError = validatePhotoFile(file, VITRINE_UPLOAD_MAX_BYTES);
      if (validationError) {
        nextError = validationError;
      }
    }

    if (nextError) {
      setError(nextError);
      return;
    }

    setError(null);
    onUpload(fileList);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    addFiles(event.dataTransfer.files);
  }

  return (
    <div className={styles.field}>
      <div className={styles.fieldHeader}>
        <div>
          <h3 className={styles.fieldTitle}>{title}</h3>
          <p className={styles.fieldDescription}>{description}</p>
        </div>
        {maxImages !== undefined ? (
          <span className={styles.imageCount}>
            {images.length} / {maxImages}
          </span>
        ) : null}
      </div>

      {images.length === 0 ? <p className={styles.emptyState}>{emptyMessage}</p> : null}

      {images.length > 0 ? (
        <div className={styles.grid}>
          {images.map((storageKey, index) => (
            <div key={storageKey} className={styles.item}>
              <div className={styles.previewWrap}>
                <img src={getPreviewUrl(storageKey)} alt="" className={styles.preview} />
                {multiple && index === 0 ? <span className={styles.badge}>1ère</span> : null}
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  disabled={uploading}
                  aria-label={`Supprimer ${getVitrineImageFilename(storageKey)}`}
                  onClick={() => onDelete(storageKey)}
                >
                  Supprimer
                </button>
              </div>
              <p className={styles.fileName}>{getVitrineImageFilename(storageKey)}</p>
            </div>
          ))}
        </div>
      ) : null}

      {showDropzone ? (
        <div
          className={[
            styles.dropzone,
            dragActive ? styles.dropzoneActive : "",
            dropzoneDisabled ? styles.dropzoneDisabled : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role="button"
          tabIndex={dropzoneDisabled ? -1 : 0}
          aria-disabled={dropzoneDisabled}
          onClick={() => {
            if (!dropzoneDisabled) {
              inputRef.current?.click();
            }
          }}
          onKeyDown={(event) => {
            if (dropzoneDisabled) {
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            if (dropzoneDisabled) {
              return;
            }
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={multiple}
            disabled={dropzoneDisabled}
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <p className={styles.dropzoneTitle}>{uploading ? "Envoi en cours…" : dropzoneTitle}</p>
          <p className={styles.dropzoneHint}>
            ou cliquez pour parcourir — JPG, PNG, WebP · max 15 Mo
          </p>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
