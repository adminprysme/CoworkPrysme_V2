import { useEffect } from "react";

import type { ServiceResponse } from "@coworkprysme/shared";

import dialogStyles from "../../spaces/components/BuildingFormPanel.module.css";
import styles from "./ServiceDeleteDialog.module.css";

interface ServiceDeleteDialogProps {
  service: ServiceResponse | null;
  open: boolean;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function ServiceDeleteDialog({
  service,
  open,
  submitting = false,
  error = null,
  onClose,
  onConfirm,
}: ServiceDeleteDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, submitting]);

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

  if (!open || !service) {
    return null;
  }

  return (
    <div
      className={dialogStyles.overlay}
      role="presentation"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className={[dialogStyles.dialog, styles.dialog].join(" ")}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="service-delete-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={dialogStyles.dialogAccent} aria-hidden="true" />

        <header className={dialogStyles.header}>
          <div className={dialogStyles.headerMain}>
            <h2 id="service-delete-title">Supprimer le service</h2>
            <p className={dialogStyles.headerSubtitle}>
              Cette action est définitive. Le service et sa photo associée seront supprimés.
            </p>
          </div>
          <div className={dialogStyles.headerActions}>
            <button
              type="button"
              className={dialogStyles.closeBtn}
              onClick={onClose}
              disabled={submitting}
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <p className={styles.message}>
            Confirmez-vous la suppression de <strong>« {service.label} »</strong> ?
          </p>
          <p className={styles.meta}>
            Clé technique : <code>{service.key}</code>
          </p>
          {error ? <p className={dialogStyles.submitError}>{error}</p> : null}
        </div>

        <footer className={dialogStyles.footer}>
          <button
            type="button"
            className={dialogStyles.secondaryBtn}
            onClick={onClose}
            disabled={submitting}
          >
            Annuler
          </button>
          <button
            type="button"
            className={styles.dangerBtn}
            disabled={submitting}
            onClick={onConfirm}
          >
            {submitting ? "Suppression…" : "Supprimer"}
          </button>
        </footer>
      </div>
    </div>
  );
}
