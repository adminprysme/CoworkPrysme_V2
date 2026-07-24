"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { Container } from "@/components/ui/Container";
import { VITRINE_LOGIN_PATH } from "@/config/site";
import {
  acceptAccountActivation,
  AccountActivationApiError,
  fetchAccountActivationPreview,
} from "@/lib/account-activation-api";
import type { PublicAccountActivationPreview } from "@coworkprysme/shared";

import styles from "../invitation/InvitationPageContent.module.css";

type PageStatus =
  "loading" | "ready" | "expired" | "already_used" | "revoked" | "not_found" | "error" | "success";

function statusFromApiCode(code: string): PageStatus | null {
  switch (code) {
    case "ACTIVATION_EXPIRED":
      return "expired";
    case "ACTIVATION_ALREADY_USED":
      return "already_used";
    case "ACTIVATION_REVOKED":
      return "revoked";
    case "ACTIVATION_NOT_FOUND":
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

export function ActivateAccountPageContent() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);

  const [status, setStatus] = useState<PageStatus>("loading");
  const [preview, setPreview] = useState<PublicAccountActivationPreview | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const viewStatus: PageStatus = !token ? "not_found" : status;

  useEffect(() => {
    if (!token) {
      setStatus("not_found");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setPreview(null);
    setFormError(null);

    void fetchAccountActivationPreview(token)
      .then((payload) => {
        if (cancelled) return;
        setPreview(payload);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof AccountActivationApiError) {
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

    setSubmitting(true);
    try {
      await acceptAccountActivation(token, { password });
      setStatus("success");
    } catch (error: unknown) {
      if (error instanceof AccountActivationApiError) {
        const mapped = statusFromApiCode(error.code);
        if (mapped) {
          setStatus(mapped);
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
          {viewStatus === "loading" ? (
            <p className={styles.muted}>Chargement de l&apos;activation…</p>
          ) : null}

          {viewStatus === "error" ? (
            <StatusCard
              title="Une erreur est survenue"
              body="Réessayez plus tard. Si le problème continue, contactez votre espace de coworking."
            />
          ) : null}

          {viewStatus === "not_found" ? (
            <StatusCard title="Lien invalide" body="Ce lien d'activation n'est pas valide." />
          ) : null}

          {viewStatus === "expired" ? (
            <StatusCard
              title="Lien expiré"
              body="Ce lien d'activation a expiré. Contactez votre espace de coworking pour en recevoir un nouveau."
            />
          ) : null}

          {viewStatus === "revoked" ? (
            <StatusCard title="Lien révoqué" body="Ce lien d'activation a été révoqué." />
          ) : null}

          {viewStatus === "already_used" ? (
            <StatusCard
              title="Compte déjà activé"
              body="Ce lien a déjà été utilisé. Si vous avez défini votre mot de passe, connectez-vous."
              action={
                <Link className={styles.primaryButton} href={VITRINE_LOGIN_PATH}>
                  Se connecter
                </Link>
              }
            />
          ) : null}

          {viewStatus === "success" ? (
            <StatusCard
              title="Mot de passe défini"
              body="Votre compte est activé. Vous allez être redirigé vers la page de connexion."
              tone="success"
              action={
                <Link className={styles.primaryButton} href={VITRINE_LOGIN_PATH}>
                  Aller à la connexion
                </Link>
              }
            />
          ) : null}

          {viewStatus === "ready" && preview ? (
            <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
              <header className={styles.header}>
                <p className={styles.eyebrow}>Activation du compte</p>
                <h1 className={styles.title}>Définir mon mot de passe</h1>
                <p className={styles.lead}>
                  Finalisez votre compte client Cowork Prysme pour accéder à votre espace.
                </p>
              </header>

              <div className={styles.infoBanner} role="note">
                <p className={styles.infoBannerTitle}>Compte</p>
                <p className={styles.infoBannerText}>
                  Email : <strong>{preview.emailMasked}</strong>
                  <br />
                  Valable jusqu&apos;au {formatExpiresAt(preview.expiresAt)}
                </p>
              </div>

              <section className={styles.card} aria-labelledby="activation-credentials-title">
                <h2 className={styles.cardTitle} id="activation-credentials-title">
                  Mot de passe
                </h2>

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

              {formError ? <p className={styles.error}>{formError}</p> : null}

              <button type="submit" className={styles.primaryButton} disabled={submitting}>
                {submitting ? "Activation…" : "Activer mon compte"}
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
