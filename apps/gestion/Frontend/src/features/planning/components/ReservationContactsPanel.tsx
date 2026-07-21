import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { IconCalendar, IconMail, IconPhone, IconSend, IconUserPlus } from "@tabler/icons-react";
import type {
  PlanningContact,
  PlanningInvitation,
  PlanningInvitationEffectiveStatus,
  PlanningReservationDetail,
} from "@coworkprysme/shared";

import {
  createPlanningInvitation,
  fetchPlanningInvitations,
  PlanningApiError,
  resendPlanningInvitation,
  revokePlanningInvitation,
} from "../../../lib/planning-api.js";
import { formatDateShort } from "../planning-utils.js";
import styles from "./ReservationContactsPanel.module.css";

interface ReservationContactsPanelProps {
  reservationId: string;
  detail: PlanningReservationDetail;
  readOnly: boolean;
}

type EmailDeliveryHint = {
  emailSent: boolean;
  emailError?: string;
};

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

export function ReservationContactsPanel({
  reservationId,
  detail,
  readOnly,
}: ReservationContactsPanelProps) {
  const [invitations, setInvitations] = useState<PlanningInvitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const [deliveryById, setDeliveryById] = useState<Record<string, EmailDeliveryHint>>({});

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
    void loadInvitations();
  }, [loadInvitations]);

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

  const typedEmail = normalizeEmail(email);
  const hasPendingForTyped = typedEmail.length > 0 && pendingEmails.has(typedEmail);
  const hasContactForTyped = typedEmail.length > 0 && contactEmails.has(typedEmail);

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

  return (
    <div className={styles.root}>
      {readOnly ? (
        <p className={styles.banner}>Réservation terminée ou annulée — lecture pure.</p>
      ) : null}

      <section className={styles.section} aria-labelledby="contacts-accounts-title">
        <div className={styles.sectionHead}>
          <h3 id="contacts-accounts-title" className={styles.sectionTitle}>
            Comptes liés
          </h3>
        </div>
        {detail.contacts.length === 0 ? (
          <p className={styles.muted}>Aucun compte client lié.</p>
        ) : (
          <ul className={styles.list}>
            {detail.contacts.map((contact) => {
              const displayName = contactDisplayName(contact);
              const phone = contact.phone?.trim();
              return (
                <li key={contact.id} className={styles.card}>
                  <div className={styles.cardMain}>
                    <strong className={styles.cardTitle}>{displayName}</strong>
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
                    </div>
                  </div>
                  <a
                    className={styles.secondaryBtn}
                    href={`mailto:${contact.email}`}
                    title="Contacter par email"
                    aria-label={`Contacter ${contact.email} par email`}
                  >
                    <IconMail size={16} stroke={1.6} aria-hidden />
                    Contacter
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="contacts-invites-title">
        <div className={styles.sectionHead}>
          <h3 id="contacts-invites-title" className={styles.sectionTitle}>
            Invitations collaborateur
          </h3>
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
                          Révoquer l&apos;invitation pour <strong>{invite.email}</strong> ? Le lien
                          ne pourra plus être utilisé.
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
      </section>
    </div>
  );
}
