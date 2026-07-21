"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { Container } from "@/components/ui/Container";
import { VITRINE_LOGIN_PATH } from "@/config/site";
import { acceptInvitation, fetchInvitationPreview, InvitationApiError } from "@/lib/invitation-api";
import type { PublicInvitationPreview } from "@coworkprysme/shared";

import styles from "./InvitationPageContent.module.css";

type PageStatus =
  "loading" | "ready" | "expired" | "revoked" | "already_used" | "not_found" | "error" | "success";

function statusFromApiCode(code: string): PageStatus | null {
  switch (code) {
    case "INVITE_EXPIRED":
      return "expired";
    case "INVITE_REVOKED":
      return "revoked";
    case "INVITE_ALREADY_USED":
      return "already_used";
    case "INVITE_NOT_FOUND":
      return "not_found";
    default:
      return null;
  }
}

function formatExpiresAt(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });
}

export function InvitationPageContent() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);

  const [status, setStatus] = useState<PageStatus>("loading");
  const [preview, setPreview] = useState<PublicInvitationPreview | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [cgvAccepted, setCgvAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successCompany, setSuccessCompany] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("not_found");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setPreview(null);
    setFormError(null);

    void fetchInvitationPreview(token)
      .then((payload) => {
        if (cancelled) return;
        setPreview(payload);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof InvitationApiError) {
          const mapped = statusFromApiCode(error.code);
          setStatus(mapped ?? "error");
          return;
        }
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (status !== "success") return;
    const timer = window.setTimeout(() => {
      window.location.assign(VITRINE_LOGIN_PATH);
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== passwordConfirm) {
      setFormError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (!privacyAccepted) {
      setFormError("Vous devez accepter la politique de confidentialité.");
      return;
    }
    if (!cgvAccepted) {
      setFormError("Vous devez accepter les Conditions Générales de Vente.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await acceptInvitation(token, {
        password,
        privacyPolicyAccepted: true,
        cgvAccepted: true,
        marketingCommunicationsAccepted: marketingAccepted,
      });
      setSuccessCompany(result.companyLabel);
      setStatus("success");
    } catch (error: unknown) {
      if (error instanceof InvitationApiError) {
        const mapped = statusFromApiCode(error.code);
        if (mapped) {
          setStatus(mapped);
          return;
        }
        if (error.code === "INVITE_EMAIL_ALREADY_REGISTERED") {
          setFormError(
            "Un compte existe déjà avec cet email. Connectez-vous ou contactez le support.",
          );
          return;
        }
        if (error.code === "VALIDATION_ERROR") {
          setFormError(error.message);
          return;
        }
      }
      setFormError("Une erreur est survenue, réessayez plus tard.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <Container>
        <div className={styles.shell}>
          {status === "loading" ? (
            <p className={styles.muted}>Chargement de l&apos;invitation…</p>
          ) : null}

          {status === "error" ? (
            <StatusCard
              title="Une erreur est survenue"
              body="Réessayez plus tard. Si le problème continue, contactez la personne qui vous a invité."
            />
          ) : null}

          {status === "not_found" ? (
            <StatusCard title="Lien invalide" body="Ce lien n'est pas valide." />
          ) : null}

          {status === "expired" ? (
            <StatusCard
              title="Invitation expirée"
              body="Ce lien d'invitation a expiré. Contactez la personne qui vous a invité pour en recevoir un nouveau."
            />
          ) : null}

          {status === "revoked" ? (
            <StatusCard title="Invitation révoquée" body="Cette invitation a été révoquée." />
          ) : null}

          {status === "already_used" ? (
            <StatusCard
              title="Invitation déjà utilisée"
              body="Cette invitation a déjà été utilisée. Si vous avez déjà un compte, connectez-vous."
              action={
                <Link className={styles.primaryButton} href={VITRINE_LOGIN_PATH}>
                  Se connecter
                </Link>
              }
            />
          ) : null}

          {status === "success" ? (
            <StatusCard
              title="Compte créé"
              body={`Votre compte collaborateur est prêt${
                successCompany ? ` pour ${successCompany}` : ""
              }. Vous allez être redirigé vers la page de connexion.`}
              tone="success"
              action={
                <Link className={styles.primaryButton} href={VITRINE_LOGIN_PATH}>
                  Aller à la connexion
                </Link>
              }
            />
          ) : null}

          {status === "ready" && preview ? (
            <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
              <header className={styles.header}>
                <p className={styles.eyebrow}>Invitation collaborateur</p>
                <h1 className={styles.title}>Créer mon compte</h1>
                <p className={styles.lead}>
                  Rejoignez l&apos;espace client <strong>{preview.companyLabel}</strong> sur Cowork
                  Prysme.
                </p>
              </header>

              <div className={styles.infoBanner} role="note">
                <p className={styles.infoBannerTitle}>Dossier</p>
                <p className={styles.infoBannerText}>
                  Société : <strong>{preview.companyLabel}</strong>
                  <br />
                  Email : <strong>{preview.emailMasked}</strong>
                  <br />
                  Valable jusqu&apos;au {formatExpiresAt(preview.expiresAt)}
                </p>
              </div>

              <section className={styles.card} aria-labelledby="invite-credentials-title">
                <h2 className={styles.cardTitle} id="invite-credentials-title">
                  Identifiants
                </h2>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Email</span>
                  <input
                    className={`${styles.input} ${styles.inputLocked}`}
                    type="text"
                    value={preview.emailMasked}
                    readOnly
                    disabled
                    tabIndex={-1}
                    aria-readonly="true"
                    autoComplete="off"
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Mot de passe</span>
                  <input
                    className={styles.input}
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Confirmer le mot de passe</span>
                  <input
                    className={styles.input}
                    type="password"
                    autoComplete="new-password"
                    value={passwordConfirm}
                    onChange={(event) => setPasswordConfirm(event.target.value)}
                    minLength={8}
                    required
                  />
                </label>
              </section>

              <section className={styles.card} aria-labelledby="invite-consent-title">
                <h2 className={styles.cardTitle} id="invite-consent-title">
                  Consentement
                </h2>

                <label className={styles.checkboxCard}>
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(event) => setPrivacyAccepted(event.target.checked)}
                  />
                  <span>
                    J&apos;accepte la{" "}
                    <Link href="/politique-de-confidentialite" className={styles.link}>
                      politique de confidentialité
                    </Link>{" "}
                    (obligatoire).
                  </span>
                </label>

                <label className={styles.checkboxCard}>
                  <input
                    type="checkbox"
                    checked={cgvAccepted}
                    onChange={(event) => setCgvAccepted(event.target.checked)}
                  />
                  <span>
                    J&apos;accepte les{" "}
                    <Link href="/cgv" className={styles.link}>
                      Conditions Générales de Vente
                    </Link>{" "}
                    (obligatoire).
                  </span>
                </label>

                <label className={styles.checkboxCard}>
                  <input
                    type="checkbox"
                    checked={marketingAccepted}
                    onChange={(event) => setMarketingAccepted(event.target.checked)}
                  />
                  <span>
                    J&apos;accepte de recevoir des communications de mon espace de coworking
                    (actualités, offres). Facultatif.
                  </span>
                </label>
              </section>

              {formError ? <p className={styles.error}>{formError}</p> : null}

              <button type="submit" className={styles.primaryButton} disabled={submitting}>
                {submitting ? "Création…" : "Créer mon compte"}
              </button>
            </form>
          ) : null}
        </div>
      </Container>
    </div>
  );
}

function StatusCard(input: {
  title: string;
  body: string;
  tone?: "default" | "success";
  action?: ReactNode;
}) {
  return (
    <section
      className={[styles.statusCard, input.tone === "success" ? styles.statusSuccess : ""]
        .filter(Boolean)
        .join(" ")}
      aria-live="polite"
    >
      <h1 className={styles.statusTitle}>{input.title}</h1>
      <p className={styles.statusBody}>{input.body}</p>
      {input.action ? <div className={styles.statusActions}>{input.action}</div> : null}
    </section>
  );
}
