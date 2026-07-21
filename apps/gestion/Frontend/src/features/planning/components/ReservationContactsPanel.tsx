import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  IconCalendar,
  IconChevronDown,
  IconMail,
  IconPhone,
  IconSend,
  IconUserPlus,
} from "@tabler/icons-react";
import type {
  PlanningContact,
  PlanningInvitation,
  PlanningInvitationEffectiveStatus,
  PlanningReservationDetail,
} from "@coworkprysme/shared";

import { useAuth } from "../../../app/AuthProvider.js";
import {
  createPlanningInvitation,
  deactivateClientAccount,
  fetchPlanningInvitations,
  PlanningApiError,
  reactivateClientAccount,
  resendPlanningInvitation,
  revokePlanningInvitation,
  transferCardexOwnership,
} from "../../../lib/planning-api.js";
import { formatDateShort } from "../planning-utils.js";
import styles from "./ReservationContactsPanel.module.css";

interface ReservationContactsPanelProps {
  reservationId: string;
  detail: PlanningReservationDetail;
  readOnly: boolean;
  /** Reload reservation detail after account mutations (roles/status). */
  onAccountsChanged?: () => void;
}

type EmailDeliveryHint = {
  emailSent: boolean;
  emailError?: string;
};

type AccountActionKind = "deactivate" | "reactivate" | "transfer";

const STATUS_LABELS: Record<PlanningInvitationEffectiveStatus, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  expired: "Expirée",
  revoked: "Révoquée",
};

function contactDisplayName(contact: PlanningContact): string {
  const fullName = [contact.firstName, contact.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return fullName || contact.email;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatExpiresLabel(iso: string): string {
  const date = new Date(iso);
  const formatted = date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `expire le ${formatted}`;
}

function inviteErrorMessage(error: unknown): string {
  if (error instanceof PlanningApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Une erreur est survenue.";
}

function sameCardex(contact: PlanningContact, cardexId: string | undefined): boolean {
  if (!cardexId || !contact.cardexId) return false;
  return contact.cardexId === cardexId;
}

export function ReservationContactsPanel({
  reservationId,
  detail,
  readOnly,
  onAccountsChanged,
}: ReservationContactsPanelProps) {
  const { user } = useAuth();
  const canManageClients = Boolean(user?.profile.permissions.clients);

  const [invitations, setInvitations] = useState<PlanningInvitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const [deliveryById, setDeliveryById] = useState<Record<string, EmailDeliveryHint>>({});
  const [invitesExpanded, setInvitesExpanded] = useState(false);

  const [confirmAction, setConfirmAction] = useState<{
    kind: AccountActionKind;
    accountId: string;
  } | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [accountBusyId, setAccountBusyId] = useState<string | null>(null);

  const cardexId = detail.cardexId;

  const loadInvitations = useCallback(async () => {
    setLoadingInvites(true);
    setListError(null);
    try {
      const payload = await fetchPlanningInvitations(reservationId);
      setInvitations(payload.invitations);
    } catch (error: unknown) {
      setListError(inviteErrorMessage(error));
    } finally {
      setLoadingInvites(false);
    }
  }, [reservationId]);

  useEffect(() => {
    setInvitesExpanded(false);
    setInviteOpen(false);
    setConfirmAction(null);
    setAccountError(null);
    void loadInvitations();
  }, [loadInvitations]);

  const pendingCount = useMemo(
    () => invitations.filter((invite) => invite.status === "pending").length,
    [invitations],
  );

  const pendingEmails = useMemo(() => {
    const set = new Set<string>();
    for (const invite of invitations) {
      if (invite.status === "pending") {
        set.add(normalizeEmail(invite.email));
      }
    }
    return set;
  }, [invitations]);

  const contactEmails = useMemo(() => {
    const set = new Set<string>();
    for (const contact of detail.contacts) {
      set.add(normalizeEmail(contact.email));
    }
    return set;
  }, [detail.contacts]);

  const activeMembersOnCardex = useMemo(
    () =>
      detail.contacts.filter(
        (contact) =>
          contact.status === "active" && contact.role === "member" && sameCardex(contact, cardexId),
      ),
    [detail.contacts, cardexId],
  );

  const lockedCount = useMemo(
    () => detail.contacts.filter((contact) => contact.status === "locked").length,
    [detail.contacts],
  );

  const typedEmail = normalizeEmail(email);
  const hasPendingForTyped = typedEmail.length > 0 && pendingEmails.has(typedEmail);
  const hasContactForTyped = typedEmail.length > 0 && contactEmails.has(typedEmail);

  function closeAccountConfirm() {
    setConfirmAction(null);
    setDeactivateReason("");
    setTransferTargetId("");
    setTransferReason("");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!isValidEmail(email)) {
      setFormError("Adresse email invalide.");
      return;
    }
    if (hasPendingForTyped) {
      setFormError(
        "Une invitation est déjà en attente pour cet email. Utilisez Renvoyer ou Révoquer.",
      );
      return;
    }
    if (hasContactForTyped) {
      setFormError("Cet email est déjà rattaché à un compte de ce dossier.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createPlanningInvitation(reservationId, {
        email: email.trim(),
      });
      setDeliveryById((prev) => ({
        ...prev,
        [result.invitation.id]: {
          emailSent: result.emailSent,
          ...(result.emailError ? { emailError: result.emailError } : {}),
        },
      }));
      setEmail("");
      setInviteOpen(false);
      setInvitesExpanded(true);
      await loadInvitations();
    } catch (error: unknown) {
      setFormError(inviteErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend(invitationId: string) {
    setActionId(invitationId);
    setFormError(null);
    try {
      const result = await resendPlanningInvitation(invitationId);
      setDeliveryById((prev) => {
        const next = { ...prev };
        delete next[invitationId];
        next[result.invitation.id] = {
          emailSent: result.emailSent,
          ...(result.emailError ? { emailError: result.emailError } : {}),
        };
        return next;
      });
      setRevokeConfirmId(null);
      await loadInvitations();
    } catch (error: unknown) {
      setFormError(inviteErrorMessage(error));
    } finally {
      setActionId(null);
    }
  }

  async function handleRevoke(invitationId: string) {
    setActionId(invitationId);
    setFormError(null);
    try {
      await revokePlanningInvitation(invitationId);
      setRevokeConfirmId(null);
      setDeliveryById((prev) => {
        const next = { ...prev };
        delete next[invitationId];
        return next;
      });
      await loadInvitations();
    } catch (error: unknown) {
      setFormError(inviteErrorMessage(error));
    } finally {
      setActionId(null);
    }
  }

  async function handleConfirmAccountAction() {
    if (!confirmAction) return;
    setAccountError(null);

    if (confirmAction.kind === "transfer") {
      if (!cardexId) {
        setAccountError("Cardex introuvable pour ce dossier.");
        return;
      }
      if (!transferTargetId) {
        setAccountError("Choisissez le nouveau propriétaire.");
        return;
      }
    }

    setAccountBusyId(confirmAction.accountId);
    try {
      if (confirmAction.kind === "deactivate") {
        const reason = deactivateReason.trim();
        await deactivateClientAccount(confirmAction.accountId, {
          ...(reason ? { reason } : {}),
        });
      } else if (confirmAction.kind === "reactivate") {
        await reactivateClientAccount(confirmAction.accountId);
      } else {
        const reason = transferReason.trim();
        await transferCardexOwnership(cardexId!, {
          nextClientAccountId: transferTargetId,
          ...(reason ? { reason } : {}),
        });
      }
      closeAccountConfirm();
      onAccountsChanged?.();
    } catch (error: unknown) {
      setAccountError(inviteErrorMessage(error));
    } finally {
      setAccountBusyId(null);
    }
  }

  function renderAccountBadges(contact: PlanningContact) {
    if (contact.status === "locked") {
      return (
        <span className={styles.statusChip} data-account-status="locked">
          Désactivé
        </span>
      );
    }
    if (contact.status === "anonymized") {
      return (
        <span className={styles.statusChip} data-account-status="anonymized">
          Anonymisé
        </span>
      );
    }
    return (
      <>
        <span className={styles.roleChip} data-role={contact.role === "owner" ? "owner" : "member"}>
          {contact.role === "owner" ? "Propriétaire" : "Collaborateur"}
        </span>
        <span className={styles.statusChip} data-account-status="active">
          Actif
        </span>
      </>
    );
  }

  function renderAccountActions(contact: PlanningContact) {
    if (readOnly || !canManageClients) {
      return (
        <a
          className={styles.secondaryBtn}
          href={`mailto:${contact.email}`}
          title="Contacter par email"
          aria-label={`Contacter ${contact.email} par email`}
        >
          <IconMail size={16} stroke={1.6} aria-hidden />
          Contacter
        </a>
      );
    }

    const busy = accountBusyId === contact.id;
    const confirming = confirmAction?.accountId === contact.id ? confirmAction.kind : null;

    if (contact.status === "locked") {
      return (
        <div className={styles.cardActions}>
          <a className={styles.secondaryBtn} href={`mailto:${contact.email}`}>
            <IconMail size={16} stroke={1.6} aria-hidden />
            Contacter
          </a>
          {confirming !== "reactivate" ? (
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy}
              onClick={() => {
                setAccountError(null);
                setConfirmAction({ kind: "reactivate", accountId: contact.id });
              }}
            >
              Réactiver
            </button>
          ) : null}
        </div>
      );
    }

    if (contact.status !== "active") {
      return (
        <a className={styles.secondaryBtn} href={`mailto:${contact.email}`}>
          <IconMail size={16} stroke={1.6} aria-hidden />
          Contacter
        </a>
      );
    }

    if (contact.role === "owner") {
      const canTransfer = activeMembersOnCardex.length > 0 && Boolean(cardexId);
      return (
        <div className={styles.cardActions}>
          <a className={styles.secondaryBtn} href={`mailto:${contact.email}`}>
            <IconMail size={16} stroke={1.6} aria-hidden />
            Contacter
          </a>
          {confirming !== "transfer" ? (
            canTransfer ? (
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={busy}
                onClick={() => {
                  setAccountError(null);
                  setTransferTargetId(activeMembersOnCardex[0]?.id ?? "");
                  setConfirmAction({ kind: "transfer", accountId: contact.id });
                }}
              >
                Transférer la propriété
              </button>
            ) : (
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled
                title="Invitez d'abord un collaborateur actif pour pouvoir lui transférer la propriété."
              >
                Transférer la propriété
              </button>
            )
          ) : null}
        </div>
      );
    }

    // active member
    return (
      <div className={styles.cardActions}>
        <a className={styles.secondaryBtn} href={`mailto:${contact.email}`}>
          <IconMail size={16} stroke={1.6} aria-hidden />
          Contacter
        </a>
        {confirming !== "deactivate" ? (
          <button
            type="button"
            className={styles.dangerOutlineBtn}
            disabled={busy}
            onClick={() => {
              setAccountError(null);
              setDeactivateReason("");
              setConfirmAction({ kind: "deactivate", accountId: contact.id });
            }}
          >
            Désactiver
          </button>
        ) : null}
      </div>
    );
  }

  function renderAccountConfirm(contact: PlanningContact) {
    if (!confirmAction || confirmAction.accountId !== contact.id) return null;
    const busy = accountBusyId === contact.id;

    if (confirmAction.kind === "deactivate") {
      return (
        <div className={styles.confirmBox} role="group" aria-label="Confirmer la désactivation">
          <p className={styles.confirmText}>
            Désactiver le compte <strong>{contact.email}</strong> ? La personne ne pourra plus se
            connecter au tunnel de réservation.
          </p>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Motif (optionnel)</span>
            <input
              className={styles.input}
              type="text"
              maxLength={500}
              value={deactivateReason}
              onChange={(event) => setDeactivateReason(event.target.value)}
              placeholder="Ex. départ collaborateur"
              disabled={busy}
            />
          </label>
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.dangerBtn}
              disabled={busy}
              onClick={() => void handleConfirmAccountAction()}
            >
              {busy ? "Désactivation…" : "Confirmer la désactivation"}
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              disabled={busy}
              onClick={closeAccountConfirm}
            >
              Annuler
            </button>
          </div>
        </div>
      );
    }

    if (confirmAction.kind === "reactivate") {
      return (
        <div className={styles.confirmBox} role="group" aria-label="Confirmer la réactivation">
          <p className={styles.confirmText}>
            Réactiver le compte <strong>{contact.email}</strong> ? L&apos;accès au tunnel de
            réservation sera rétabli.
          </p>
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy}
              onClick={() => void handleConfirmAccountAction()}
            >
              {busy ? "Réactivation…" : "Confirmer la réactivation"}
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              disabled={busy}
              onClick={closeAccountConfirm}
            >
              Annuler
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.confirmBox} role="group" aria-label="Confirmer le transfert">
        <p className={styles.confirmText}>
          Transférer la propriété du dossier. Le compte actuel passera automatiquement en
          collaborateur.
        </p>
        {activeMembersOnCardex.length === 0 ? (
          <p className={styles.hintWarn}>
            Aucun collaborateur actif sur ce dossier. Invitez d&apos;abord un collaborateur, puis
            réessayez.
          </p>
        ) : (
          <>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Nouveau propriétaire</span>
              <select
                className={styles.input}
                value={transferTargetId}
                onChange={(event) => setTransferTargetId(event.target.value)}
                disabled={busy}
              >
                {activeMembersOnCardex.map((member) => (
                  <option key={member.id} value={member.id}>
                    {contactDisplayName(member)} — {member.email}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Motif (optionnel)</span>
              <input
                className={styles.input}
                type="text"
                maxLength={500}
                value={transferReason}
                onChange={(event) => setTransferReason(event.target.value)}
                disabled={busy}
              />
            </label>
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={busy || !transferTargetId}
                onClick={() => void handleConfirmAccountAction()}
              >
                {busy ? "Transfert…" : "Confirmer le transfert"}
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                disabled={busy}
                onClick={closeAccountConfirm}
              >
                Annuler
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {readOnly ? (
        <p className={styles.banner}>Réservation terminée ou annulée — lecture pure.</p>
      ) : null}

      {!readOnly && !canManageClients ? (
        <p className={styles.banner}>
          Votre profil n&apos;a pas la permission <strong>clients</strong> — consultation seule des
          comptes (désactivation / transfert indisponibles).
        </p>
      ) : null}

      <section className={styles.section} aria-labelledby="contacts-accounts-title">
        <div className={styles.sectionHead}>
          <h3 id="contacts-accounts-title" className={styles.sectionTitle}>
            Comptes liés
            {detail.contacts.length > 0 ? (
              <span className={styles.inviteCount}> ({detail.contacts.length})</span>
            ) : null}
            {lockedCount > 0 ? (
              <span className={styles.lockedHint}>
                {" "}
                · {lockedCount} désactivé{lockedCount > 1 ? "s" : ""}
              </span>
            ) : null}
          </h3>
        </div>

        {accountError ? <p className={styles.error}>{accountError}</p> : null}

        {!cardexId && detail.contacts.some((c) => c.role === "owner") ? (
          <p className={styles.hintWarn}>
            Cardex manquant sur cette réservation — le transfert de propriété est indisponible.
          </p>
        ) : null}

        {detail.contacts.length === 0 ? (
          <p className={styles.muted}>Aucun compte client lié.</p>
        ) : (
          <ul className={styles.list}>
            {detail.contacts.map((contact) => {
              const displayName = contactDisplayName(contact);
              const phone = contact.phone?.trim();
              const isOwnerActive =
                contact.role === "owner" &&
                contact.status === "active" &&
                sameCardex(contact, cardexId);
              const showTransferHint =
                isOwnerActive &&
                canManageClients &&
                !readOnly &&
                activeMembersOnCardex.length === 0 &&
                confirmAction?.accountId !== contact.id;

              return (
                <li key={contact.id} className={styles.card}>
                  <div className={styles.cardMain}>
                    <div className={styles.inviteTitleRow}>
                      <strong className={styles.cardTitle}>{displayName}</strong>
                      {renderAccountBadges(contact)}
                    </div>
                    <div className={styles.meta}>
                      <span className={styles.metaRow}>
                        <IconMail size={14} stroke={1.6} aria-hidden />
                        {contact.email}
                      </span>
                      {phone ? (
                        <span className={styles.metaRow}>
                          <IconPhone size={14} stroke={1.6} aria-hidden />
                          {phone}
                        </span>
                      ) : null}
                      <span className={styles.metaRow}>
                        <IconCalendar size={14} stroke={1.6} aria-hidden />
                        Créé le {formatDateShort(contact.createdAt)}
                      </span>
                      {contact.status === "locked" && contact.lockedAt ? (
                        <span className={styles.metaRow}>
                          Désactivé le {formatDateShort(contact.lockedAt)}
                          {contact.lockReason ? ` — ${contact.lockReason}` : ""}
                        </span>
                      ) : null}
                    </div>

                    {showTransferHint ? (
                      <p className={styles.hintWarn}>
                        Aucun collaborateur actif pour recevoir la propriété. Invitez un
                        collaborateur d&apos;abord.
                      </p>
                    ) : null}

                    {renderAccountConfirm(contact)}
                  </div>
                  {renderAccountActions(contact)}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="contacts-invites-title">
        <div className={styles.sectionHead}>
          <button
            type="button"
            className={styles.inviteDisclosure}
            aria-expanded={invitesExpanded}
            aria-controls="contacts-invites-panel"
            onClick={() => setInvitesExpanded((open) => !open)}
          >
            <span id="contacts-invites-title" className={styles.sectionTitle}>
              Invitations collaborateur
              {!loadingInvites ? (
                <span className={styles.inviteCount}> ({invitations.length})</span>
              ) : null}
              {pendingCount > 0 ? (
                <span className={styles.pendingHint}> · {pendingCount} en attente</span>
              ) : null}
            </span>
            <IconChevronDown
              size={18}
              stroke={1.7}
              aria-hidden
              className={invitesExpanded ? styles.inviteChevronOpen : styles.inviteChevron}
            />
          </button>
          {!readOnly ? (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => {
                setInviteOpen((open) => !open);
                setFormError(null);
              }}
            >
              <IconUserPlus size={16} stroke={1.7} aria-hidden />
              Inviter un collaborateur
            </button>
          ) : null}
        </div>

        {!readOnly && inviteOpen ? (
          <form
            className={styles.inviteForm}
            onSubmit={(event) => void handleCreate(event)}
            noValidate
          >
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Email du collaborateur</span>
              <input
                className={styles.input}
                type="email"
                autoComplete="off"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setFormError(null);
                }}
                placeholder="collaborateur@entreprise.fr"
                disabled={submitting}
              />
            </label>
            {hasPendingForTyped ? (
              <p className={styles.hintWarn}>
                Une invitation pending existe déjà pour cet email — utilisez Renvoyer ou Révoquer.
              </p>
            ) : null}
            {hasContactForTyped && !hasPendingForTyped ? (
              <p className={styles.hintWarn}>
                Cet email correspond déjà à un compte lié à ce dossier.
              </p>
            ) : null}
            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.primaryBtn}
                disabled={submitting || !email.trim() || hasPendingForTyped || hasContactForTyped}
              >
                <IconSend size={15} stroke={1.7} aria-hidden />
                {submitting ? "Envoi…" : "Envoyer l'invitation"}
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                disabled={submitting}
                onClick={() => {
                  setInviteOpen(false);
                  setEmail("");
                  setFormError(null);
                }}
              >
                Annuler
              </button>
            </div>
          </form>
        ) : null}

        {formError ? <p className={styles.error}>{formError}</p> : null}

        {invitesExpanded ? (
          <div id="contacts-invites-panel" className={styles.invitePanel}>
            {listError ? <p className={styles.error}>{listError}</p> : null}

            {loadingInvites ? <p className={styles.muted}>Chargement des invitations…</p> : null}

            {!loadingInvites && invitations.length === 0 ? (
              <p className={styles.muted}>Aucune invitation pour ce dossier.</p>
            ) : null}

            {!loadingInvites && invitations.length > 0 ? (
              <ul className={styles.list}>
                {invitations.map((invite) => {
                  const delivery = deliveryById[invite.id];
                  const busy = actionId === invite.id;
                  const canAct = !readOnly && invite.status === "pending";
                  const confirmingRevoke = revokeConfirmId === invite.id;

                  return (
                    <li key={invite.id} className={styles.card}>
                      <div className={styles.cardMain}>
                        <div className={styles.inviteTitleRow}>
                          <strong className={styles.cardTitle}>{invite.email}</strong>
                          <span className={styles.statusChip} data-status={invite.status}>
                            {STATUS_LABELS[invite.status]}
                          </span>
                          {delivery ? (
                            delivery.emailSent ? (
                              <span className={styles.emailOkChip}>Email envoyé</span>
                            ) : (
                              <span
                                className={styles.emailFailChip}
                                title={
                                  delivery.emailError
                                    ? `Email non envoyé — ${delivery.emailError}`
                                    : "Email non envoyé"
                                }
                              >
                                ⚠ Email non envoyé
                              </span>
                            )
                          ) : null}
                        </div>
                        <div className={styles.meta}>
                          {invite.status === "pending" ? (
                            <span className={styles.metaRow}>
                              <IconCalendar size={14} stroke={1.6} aria-hidden />
                              {formatExpiresLabel(invite.expiresAt)}
                            </span>
                          ) : null}
                          {invite.status === "accepted" && invite.acceptedAt ? (
                            <span className={styles.metaRow}>
                              Acceptée le {formatDateShort(invite.acceptedAt)}
                            </span>
                          ) : null}
                          {invite.status === "revoked" && invite.revokedAt ? (
                            <span className={styles.metaRow}>
                              Révoquée le {formatDateShort(invite.revokedAt)}
                            </span>
                          ) : null}
                          {invite.status === "expired" ? (
                            <span className={styles.metaRow}>
                              Expirée le {formatDateShort(invite.expiresAt)}
                            </span>
                          ) : null}
                          <span className={styles.metaRow}>
                            Dernier envoi le {formatDateShort(invite.lastSentAt)}
                          </span>
                        </div>

                        {canAct && confirmingRevoke ? (
                          <div
                            className={styles.confirmBox}
                            role="group"
                            aria-label="Confirmer la révocation"
                          >
                            <p className={styles.confirmText}>
                              Révoquer l&apos;invitation pour <strong>{invite.email}</strong> ? Le
                              lien ne pourra plus être utilisé.
                            </p>
                            <div className={styles.formActions}>
                              <button
                                type="button"
                                className={styles.dangerBtn}
                                disabled={busy}
                                onClick={() => void handleRevoke(invite.id)}
                              >
                                {busy ? "Révocation…" : "Confirmer la révocation"}
                              </button>
                              <button
                                type="button"
                                className={styles.ghostBtn}
                                disabled={busy}
                                onClick={() => setRevokeConfirmId(null)}
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {canAct && !confirmingRevoke ? (
                        <div className={styles.cardActions}>
                          <button
                            type="button"
                            className={styles.secondaryBtn}
                            disabled={busy}
                            onClick={() => void handleResend(invite.id)}
                          >
                            {busy ? "…" : "Renvoyer"}
                          </button>
                          <button
                            type="button"
                            className={styles.dangerOutlineBtn}
                            disabled={busy}
                            onClick={() => setRevokeConfirmId(invite.id)}
                          >
                            Révoquer
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
