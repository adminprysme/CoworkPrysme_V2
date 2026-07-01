import { useRef, useState, type DragEvent } from "react";

import type { BuildingPhoto } from "../types.js";
import { validatePhotoFile } from "../utils/validation.js";
import styles from "./PhotoUploadGallery.module.css";

interface PhotoUploadGalleryProps {
  photos: BuildingPhoto[];
  onChange: (photos: BuildingPhoto[]) => void;
}

export function PhotoUploadGallery({ photos, onChange }: PhotoUploadGalleryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFiles(fileList: FileList | null) {
    if (!fileList) {
      return;
    }

    const nextPhotos = [...photos];
    let nextError: string | null = null;

    for (const file of Array.from(fileList)) {
      const validationError = validatePhotoFile(file);
      if (validationError) {
        nextError = validationError;
        continue;
      }

      nextPhotos.push({
        id: crypto.randomUUID(),
        previewUrl: URL.createObjectURL(file),
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
    }

    onChange(nextPhotos);
    setError(nextError);
  }

  function removePhoto(photoId: string) {
    const target = photos.find((photo) => photo.id === photoId);
    if (target?.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(target.previewUrl);
    }
    onChange(photos.filter((photo) => photo.id !== photoId));
  }

  function movePhoto(photoId: string, direction: -1 | 1) {
    const index = photos.findIndex((photo) => photo.id === photoId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= photos.length) {
      return;
    }
    const next = [...photos];
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item!);
    onChange(next);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    addFiles(event.dataTransfer.files);
  }

  return (
    <div className={styles.gallery}>
      <div
        className={[styles.dropzone, dragActive ? styles.dropzoneActive : ""]
          .filter(Boolean)
          .join(" ")}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
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
          multiple
          onChange={(event) => addFiles(event.target.files)}
        />
        <p className={styles.dropzoneTitle}>Glissez-déposez vos photos ici</p>
        <p className={styles.dropzoneHint}>
          ou cliquez pour parcourir — JPG, PNG, WebP · max 15 Mo · upload définitif à venir
        </p>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {photos.length > 0 ? (
        <div className={styles.grid}>
          {photos.map((photo, index) => (
            <div key={photo.id} className={styles.item}>
              <div className={styles.previewWrap}>
                {photo.previewUrl ? (
                  <img src={photo.previewUrl} alt={photo.fileName} className={styles.preview} />
                ) : (
                  <div className={styles.previewFallback}>
                    <span>{photo.storageKey ? "Photo enregistrée" : "Aperçu"}</span>
                  </div>
                )}
                {index === 0 ? <span className={styles.mainBadge}>Principale</span> : null}
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  disabled={index === 0}
                  aria-label={`Monter ${photo.fileName}`}
                  onClick={() => movePhoto(photo.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  disabled={index === photos.length - 1}
                  aria-label={`Descendre ${photo.fileName}`}
                  onClick={() => movePhoto(photo.id, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  aria-label={`Supprimer ${photo.fileName}`}
                  onClick={() => removePhoto(photo.id)}
                >
                  ✕
                </button>
              </div>
              <p className={styles.fileName}>{photo.fileName}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
