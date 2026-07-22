import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  IconDownload,
  IconFileText,
  IconPlus,
  IconReceipt,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import type {
  PlanningReservationDetail,
  StaffCardexDocument,
  StaffCardexDocumentCategory,
  StaffCardexInvoice,
  StaffInvoiceStatus,
} from "@coworkprysme/shared";

import { useAuth } from "../../../app/AuthProvider.js";
import {
  deleteCardexDocument,
  downloadCardexDocument,
  downloadCardexInvoicePdf,
  fetchCardexDocuments,
  fetchCardexInvoices,
  PlanningApiError,
  uploadCardexDocument,
} from "../../../lib/planning-api.js";
import { formatCentsEur, formatDateShort } from "../planning-utils.js";
import styles from "./ReservationDocumentsPanel.module.css";

interface ReservationDocumentsPanelProps {
  detail: PlanningReservationDetail;
}

const INVOICE_STATUS_LABELS: Record<StaffInvoiceStatus, string> = {
  proforma: "Proforma",
  issued: "Émise",
  partially_paid: "Partiellement payée",
  paid: "Acquittée",
  overdue: "En retard",
  cancelled: "Annulée",
};

function apiErrorMessage(error: unknown): string {
  if (error instanceof PlanningApiError) {
    switch (error.code) {
      case "UNSUPPORTED_FILE_TYPE":
        return "Type de fichier non supporté. Formats acceptés : PDF, JPEG, PNG ou WebP.";
      case "FILE_TOO_LARGE":
        return "Fichier trop volumineux (maximum 15 Mo).";
      case "EMPTY_FILE":
        return "Le fichier est vide.";
      case "MISSING_FILE":
        return "Veuillez sélectionner un fichier.";
      case "VALIDATION_ERROR":
        return "Vérifiez la catégorie et le libellé (120 caractères max).";
      case "DOCUMENT_NOT_FOUND":
        return "Document introuvable.";
      case "INVOICE_NOT_FOUND":
        return "Facture introuvable.";
      case "CARDEX_NOT_FOUND":
        return "Dossier (cardex) introuvable.";
      default:
        return error.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Une erreur est survenue.";
}

function documentTitle(doc: StaffCardexDocument): string {
  return doc.label?.trim() || doc.originalFilename;
}

function staffUploaderLabel(staffProfileId: string): string {
  return `Staff · …${staffProfileId.slice(-6)}`;
}

export function ReservationDocumentsPanel({ detail }: ReservationDocumentsPanelProps) {
  const { user } = useAuth();
  const canManageClients = Boolean(user?.profile.permissions.clients);
  const cardexId = detail.cardexId;

  const [invoices, setInvoices] = useState<StaffCardexInvoice[]>([]);
  const [contracts, setContracts] = useState<StaffCardexDocument[]>([]);
  const [others, setOthers] = useState<StaffCardexDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [uploadCategory, setUploadCategory] = useState<StaffCardexDocumentCategory | null>(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!cardexId) {
      setInvoices([]);
      setContracts([]);
      setOthers([]);
      setLoading(false);
      setListError(null);
      return;
    }

    setLoading(true);
    setListError(null);
    try {
      const [docsPayload, invoicesPayload] = await Promise.all([
        fetchCardexDocuments(cardexId),
        fetchCardexInvoices(cardexId),
      ]);
      setContracts(docsPayload.contracts);
      setOthers(docsPayload.others);
      setInvoices(invoicesPayload.invoices);
    } catch (error: unknown) {
      setListError(apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [cardexId]);

  useEffect(() => {
    setUploadCategory(null);
    setUploadLabel("");
    setUploadError(null);
    setDeleteConfirmId(null);
    setActionError(null);
    void loadAll();
  }, [loadAll]);

  const openUpload = (category: StaffCardexDocumentCategory) => {
    setUploadCategory(category);
    setUploadLabel("");
    setUploadError(null);
    setActionError(null);
    setDeleteConfirmId(null);
  };

  const closeUpload = () => {
    setUploadCategory(null);
    setUploadLabel("");
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cardexId || !uploadCategory || !canManageClients) return;

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError("Veuillez sélectionner un fichier.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      await uploadCardexDocument(cardexId, file, {
        category: uploadCategory,
        label: uploadLabel.trim() || undefined,
      });
      closeUpload();
      await loadAll();
    } catch (error: unknown) {
      setUploadError(apiErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadDocument = async (doc: StaffCardexDocument) => {
    if (!cardexId) return;
    setBusyId(doc.id);
    setActionError(null);
    try {
      await downloadCardexDocument(cardexId, doc.id, doc.originalFilename);
    } catch (error: unknown) {
      setActionError(apiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadInvoice = async (invoice: StaffCardexInvoice) => {
    if (!cardexId) return;
    setBusyId(invoice.id);
    setActionError(null);
    try {
      await downloadCardexInvoicePdf(
        cardexId,
        invoice.id,
        `${invoice.type}-${invoice.reference}.pdf`,
      );
    } catch (error: unknown) {
      setActionError(apiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteDocument = async (doc: StaffCardexDocument) => {
    if (!cardexId || !canManageClients) return;
    setBusyId(doc.id);
    setActionError(null);
    try {
      await deleteCardexDocument(cardexId, doc.id);
      setDeleteConfirmId(null);
      await loadAll();
    } catch (error: unknown) {
      setActionError(apiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const renderUploadForm = (category: StaffCardexDocumentCategory) => {
    if (uploadCategory !== category) return null;
    const title = category === "contract" ? "Ajouter un contrat" : "Ajouter un document";
    return (
      <form className={styles.uploadForm} onSubmit={(event) => void handleUploadSubmit(event)}>
        <p className={styles.uploadFormTitle}>{title}</p>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Fichier (PDF, JPEG, PNG ou WebP — max. 15 Mo)</span>
          <input
            ref={fileInputRef}
            className={styles.fileInput}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            disabled={uploading}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Libellé (optionnel)</span>
          <input
            className={styles.input}
            type="text"
            maxLength={120}
            placeholder={
              category === "contract" ? "Ex. Contrat de prestation" : "Ex. RIB, Pièce d'identité"
            }
            value={uploadLabel}
            disabled={uploading}
            onChange={(event) => setUploadLabel(event.target.value)}
          />
        </label>
        {uploadError ? <p className={styles.error}>{uploadError}</p> : null}
        <div className={styles.formActions}>
          <button type="submit" className={styles.primaryBtn} disabled={uploading}>
            <IconUpload size={15} stroke={1.7} aria-hidden />
            {uploading ? "Envoi…" : "Téléverser"}
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={uploading}
            onClick={closeUpload}
          >
            Annuler
          </button>
        </div>
      </form>
    );
  };

  const renderDocumentCard = (doc: StaffCardexDocument) => {
    const busy = busyId === doc.id;
    const confirming = deleteConfirmId === doc.id;

    if (confirming) {
      return (
        <li key={doc.id} className={styles.card}>
          <div className={styles.cardMain}>
            <p className={styles.cardTitle}>Supprimer « {documentTitle(doc)} » ?</p>
            <p className={styles.metaRow}>
              Suppression définitive du fichier et de la fiche (trace d&apos;audit conservée).
            </p>
            {actionError && busyId === doc.id ? (
              <p className={styles.error}>{actionError}</p>
            ) : null}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.dangerBtn}
                disabled={busy || !canManageClients}
                onClick={() => void handleDeleteDocument(doc)}
              >
                {busy ? "Suppression…" : "Confirmer la suppression"}
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                disabled={busy}
                onClick={() => setDeleteConfirmId(null)}
              >
                Annuler
              </button>
            </div>
          </div>
        </li>
      );
    }

    return (
      <li key={doc.id} className={styles.card}>
        <div className={styles.cardIcon} aria-hidden>
          <IconFileText size={18} stroke={1.6} />
        </div>
        <div className={styles.cardMain}>
          <div className={styles.titleRow}>
            <p className={styles.cardTitle}>{documentTitle(doc)}</p>
            {doc.clientVisible ? (
              <span className={styles.visibilityChip} data-visible="true">
                Visible client
              </span>
            ) : (
              <span className={styles.visibilityChip} data-visible="false">
                Non visible client
              </span>
            )}
          </div>
          <div className={styles.meta}>
            {doc.label ? <span className={styles.metaRow}>{doc.originalFilename}</span> : null}
            <span className={styles.metaRow}>
              Ajouté le {formatDateShort(doc.uploadedAt)} ·{" "}
              {staffUploaderLabel(doc.uploadedByStaffProfileId)}
            </span>
          </div>
        </div>
        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={busy}
            onClick={() => void handleDownloadDocument(doc)}
          >
            <IconDownload size={15} stroke={1.7} aria-hidden />
            {busy ? "…" : "Télécharger"}
          </button>
          {canManageClients ? (
            <button
              type="button"
              className={styles.dangerOutlineBtn}
              disabled={busy}
              onClick={() => {
                setActionError(null);
                setUploadCategory(null);
                setDeleteConfirmId(doc.id);
              }}
            >
              <IconTrash size={15} stroke={1.7} aria-hidden />
              Supprimer
            </button>
          ) : null}
        </div>
      </li>
    );
  };

  if (!cardexId) {
    return (
      <div className={styles.root}>
        <p className={styles.banner}>
          Aucun cardex lié à cette réservation — les documents de dossier ne sont pas disponibles.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {!canManageClients ? (
        <p className={styles.banner}>
          Votre profil n&apos;a pas la permission <strong>clients</strong> — consultation seule des
          documents (ajout / suppression indisponibles).
        </p>
      ) : null}

      {listError ? <p className={styles.error}>{listError}</p> : null}
      {actionError && !deleteConfirmId ? <p className={styles.error}>{actionError}</p> : null}
      {loading ? <p className={styles.muted}>Chargement des documents…</p> : null}

      {!loading ? (
        <>
          <section className={styles.section} aria-labelledby="documents-billing-title">
            <div className={styles.sectionHead}>
              <h3 id="documents-billing-title" className={styles.sectionTitle}>
                Facturation
                {invoices.length > 0 ? (
                  <span className={styles.count}> ({invoices.length})</span>
                ) : null}
              </h3>
            </div>
            {invoices.length === 0 ? (
              <p className={styles.empty}>Aucune facture pour ce dossier.</p>
            ) : (
              <ul className={styles.list}>
                {invoices.map((invoice) => {
                  const busy = busyId === invoice.id;
                  return (
                    <li key={invoice.id} className={styles.card}>
                      <div className={styles.cardIcon} aria-hidden>
                        <IconReceipt size={18} stroke={1.6} />
                      </div>
                      <div className={styles.cardMain}>
                        <div className={styles.titleRow}>
                          <p className={styles.cardTitle}>{invoice.reference}</p>
                          <span
                            className={styles.statusChip}
                            data-status={invoice.status === "paid" ? "paid" : invoice.status}
                          >
                            {INVOICE_STATUS_LABELS[invoice.status]}
                          </span>
                        </div>
                        <div className={styles.meta}>
                          <span className={styles.metaRow}>
                            {formatCentsEur(invoice.totals.ttc)} TTC
                            {invoice.issuedAt ? ` · ${formatDateShort(invoice.issuedAt)}` : null}
                          </span>
                          {invoice.type === "proforma" ? (
                            <span className={styles.metaRowMuted}>Proforma</span>
                          ) : (
                            <span className={styles.metaRowMuted}>Facture finale</span>
                          )}
                        </div>
                      </div>
                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          disabled={busy}
                          onClick={() => void handleDownloadInvoice(invoice)}
                        >
                          <IconDownload size={15} stroke={1.7} aria-hidden />
                          {busy ? "…" : "PDF"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={styles.section} aria-labelledby="documents-contracts-title">
            <div className={styles.sectionHead}>
              <h3 id="documents-contracts-title" className={styles.sectionTitle}>
                Contrats
                {contracts.length > 0 ? (
                  <span className={styles.count}> ({contracts.length})</span>
                ) : null}
              </h3>
              {canManageClients && uploadCategory !== "contract" ? (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => openUpload("contract")}
                >
                  <IconPlus size={15} stroke={1.7} aria-hidden />
                  Ajouter un contrat
                </button>
              ) : null}
            </div>
            <p className={styles.sectionHint}>Documents destinés à être visibles par le client.</p>
            {renderUploadForm("contract")}
            {contracts.length === 0 && uploadCategory !== "contract" ? (
              <p className={styles.empty}>Aucun contrat pour ce dossier.</p>
            ) : (
              <ul className={styles.list}>{contracts.map(renderDocumentCard)}</ul>
            )}
          </section>

          <section className={styles.section} aria-labelledby="documents-other-title">
            <div className={styles.sectionHead}>
              <h3 id="documents-other-title" className={styles.sectionTitle}>
                Autres
                {others.length > 0 ? (
                  <span className={styles.count}> ({others.length})</span>
                ) : null}
              </h3>
              {canManageClients && uploadCategory !== "other" ? (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => openUpload("other")}
                >
                  <IconPlus size={15} stroke={1.7} aria-hidden />
                  Ajouter un document
                </button>
              ) : null}
            </div>
            <p className={styles.sectionHint}>
              Pièces internes — jamais visibles par le client (RIB, identité, etc.).
            </p>
            {renderUploadForm("other")}
            {others.length === 0 && uploadCategory !== "other" ? (
              <p className={styles.empty}>Aucun autre document pour ce dossier.</p>
            ) : (
              <ul className={styles.list}>{others.map(renderDocumentCard)}</ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
