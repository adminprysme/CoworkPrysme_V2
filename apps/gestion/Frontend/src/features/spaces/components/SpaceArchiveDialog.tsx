import { useEffect, useState } from "react";

import type { Space } from "../space-types.js";
import dialogStyles from "./BuildingFormPanel.module.css";
import styles from "./SpaceArchiveDialog.module.css";

interface SpaceArchiveDialogProps {
  space: Space | null;
  open: boolean;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function SpaceArchiveDialog({
  space,
  open,
  submitting = false,
  error = null,
  onClose,
  onConfirm,
}: SpaceArchiveDialogProps) {
  const [confirmName, setConfirmName] = useState("");

  useEffect(() => {
    if (open) {
      setConfirmName("");
    }
  }, [open, space?.id]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

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

  if (!open || !space) {
    return null;
  }

  const canConfirm = confirmName.trim() === space.name;

  return (
    <div className={dialogStyles.overlay} role="presentation" onClick={onClose}>
      <div
        className={[dialogStyles.dialog, styles.dialog].join(" ")}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="space-archive-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={dialogStyles.dialogAccent} aria-hidden="true" />

        <header className={dialogStyles.header}>
          <div className={dialogStyles.headerMain}>
            <h2 id="space-archive-title">Archiver {space.name}</h2>
            <p className={dialogStyles.headerSubtitle}>
              L&apos;espace sera retiré du catalogue et du planning, mais conservé pour
              l&apos;historique des réservations et les obligations légales.
            </p>
          </div>
          <div className={dialogStyles.headerActions}>
            <button
              type="button"
              className={dialogStyles.closeBtn}
              onClick={onClose}
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <ul className={styles.effectsList}>
            <li>Plus visible sur la vitrine ni réservable</li>
            <li>Conservé dans l&apos;historique (réservations, facturation)</li>
            <li>Restaurable ultérieurement depuis les espaces archivés</li>
          </ul>

          <label className={styles.confirmField} htmlFor="space-archive-confirm">
            <span className={styles.confirmLabel}>
              Saisissez le nom de l&apos;espace pour confirmer
            </span>
            <input
              id="space-archive-confirm"
              className={styles.confirmInput}
              value={confirmName}
              placeholder={space.name}
              onChange={(event) => setConfirmName(event.target.value)}
            />
          </label>

          {error ? <p className={dialogStyles.submitError}>{error}</p> : null}
        </div>

        <footer className={dialogStyles.footer}>
          <button type="button" className={dialogStyles.secondaryBtn} onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className={styles.dangerBtn}
            disabled={!canConfirm || submitting}
            onClick={onConfirm}
          >
            {submitting ? "Archivage…" : "Archiver l'espace"}
          </button>
        </footer>
      </div>
    </div>
  );
}
