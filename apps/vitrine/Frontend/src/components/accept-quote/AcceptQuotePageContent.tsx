"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { Container } from "@/components/ui/Container";
import { VITRINE_LOGIN_PATH } from "@/config/site";
import {
  confirmQuoteAccept,
  confirmQuoteAcceptLogin,
  fetchQuoteAcceptPreview,
  QuoteAcceptApiError,
} from "@/lib/quote-accept-api";
import type { PublicQuoteAcceptPreview } from "@coworkprysme/shared";

import styles from "../invitation/InvitationPageContent.module.css";

type PageStatus =
  "loading" | "ready" | "expired" | "invalid_status" | "not_found" | "error" | "success";

function statusFromApiCode(code: string): PageStatus | null {
  switch (code) {
    case "QUOTE_ACCEPT_EXPIRED":
      return "expired";
    case "QUOTE_ACCEPT_INVALID_STATUS":
      return "invalid_status";
    case "QUOTE_ACCEPT_NOT_FOUND":
      return "not_found";
    default:
      return null;
  }
}

function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatValidUntil(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });
}

export function AcceptQuotePageContent() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);

  const [status, setStatus] = useState<PageStatus>("loading");
  const [preview, setPreview] = useState<PublicQuoteAcceptPreview | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [cgvAccepted, setCgvAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [successReference, setSuccessReference] = useState<string | null>(null);

  // Empty token → not_found immediately (don't wait for effect / stay on loading).
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

    void fetchQuoteAcceptPreview(token)
      .then((payload) => {
        if (cancelled) return;
        setPreview(payload);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof QuoteAcceptApiError) {
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview) return;
    setFormError(null);

    if (preview.needsRegistration) {
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
    } else if (!email.trim() || !password) {
      setFormError("Indiquez votre email et votre mot de passe.");
      return;
    }

    setSubmitting(true);
    try {
      const result = preview.needsRegistration
        ? await confirmQuoteAccept(token, {
            password,
            privacyPolicyAccepted: true,
            marketingCommunicationsAccepted: marketingAccepted,
            cgvAccepted: true,
          })
        : await confirmQuoteAcceptLogin(token, {
            email: email.trim(),
            password,
          });

      setSuccessReference(result.reference);
      setPaymentUrl(result.paymentUrl ?? null);
      setStatus("success");
      if (result.paymentUrl) {
        window.setTimeout(() => {
          window.location.assign(result.paymentUrl!);
        }, 2200);
      }
    } catch (error: unknown) {
      if (error instanceof QuoteAcceptApiError) {
        const mapped = statusFromApiCode(error.code);
        if (mapped) {
          setStatus(mapped);
          return;
        }
        if (error.code === "QUOTE_ACCEPT_EMAIL_REGISTERED") {
          setFormError(
            "Un compte existe déjà pour cet email. Connectez-vous ci-dessous pour accepter le devis.",
          );
          return;
        }
        if (error.code === "QUOTE_ACCEPT_SLOT_UNAVAILABLE") {
          setFormError("Le créneau n'est plus disponible. Contactez votre espace de coworking.");
          return;
        }
        if (error.code === "ACCOUNT_PENDING_ACTIVATION") {
          setFormError(error.message);
          return;
        }
        if (error.code === "ACCOUNT_LOCKED") {
          setFormError(error.message);
          return;
        }
        if (error.code === "QUOTE_ACCEPT_ACCOUNT_INVALID" || error.code === "VALIDATION_ERROR") {
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
          {viewStatus === "loading" ? <p className={styles.muted}>Chargement du devis…</p> : null}

          {viewStatus === "error" ? (
            <StatusCard
              title="Une erreur est survenue"
              body="Réessayez plus tard. Si le problème continue, contactez votre espace de coworking."
            />
          ) : null}

          {viewStatus === "not_found" ? (
            <StatusCard title="Lien invalide" body="Ce lien d'acceptation n'est pas valide." />
          ) : null}

          {viewStatus === "expired" ? (
            <StatusCard
              title="Devis expiré"
              body="Ce devis a expiré. Contactez votre espace de coworking pour en recevoir un nouveau."
            />
          ) : null}

          {viewStatus === "invalid_status" ? (
            <StatusCard
              title="Devis non acceptable"
              body="Ce devis a déjà été accepté ou n'est plus disponible."
            />
          ) : null}

          {viewStatus === "success" ? (
            <StatusCard
              title="Devis accepté"
              body={
                paymentUrl
                  ? `Le devis ${successReference ?? ""} est accepté. Redirection vers le paiement…`
                  : `Le devis ${successReference ?? ""} est accepté. Vous recevrez un email de confirmation.`
              }
              tone="success"
              action={
                paymentUrl ? (
                  <Link className={styles.primaryButton} href={paymentUrl}>
                    Payer maintenant
                  </Link>
                ) : (
                  <Link className={styles.primaryButton} href={VITRINE_LOGIN_PATH}>
                    Se connecter
                  </Link>
                )
              }
            />
          ) : null}

          {viewStatus === "ready" && preview ? (
            <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
              <header className={styles.header}>
                <p className={styles.eyebrow}>Acceptation de devis</p>
                <h1 className={styles.title}>Accepter mon devis</h1>
                <p className={styles.lead}>
                  {preview.needsRegistration
                    ? "Créez votre compte pour accepter ce devis."
                    : "Connectez-vous pour accepter ce devis."}
                </p>
              </header>

              <div className={styles.infoBanner} role="note">
                <p className={styles.infoBannerTitle}>Devis {preview.reference}</p>
                <p className={styles.infoBannerText}>
                  Email : <strong>{preview.emailMasked}</strong>
                  <br />
                  Valable jusqu&apos;au {formatValidUntil(preview.validUntil)}
                  {preview.totals ? (
                    <>
                      <br />
                      Total TTC : <strong>{formatEuro(preview.totals.totalTTC)}</strong>
                    </>
                  ) : null}
                </p>
              </div>

              <section className={styles.card} aria-labelledby="accept-credentials-title">
                <h2 className={styles.cardTitle} id="accept-credentials-title">
                  {preview.needsRegistration ? "Créer mon compte" : "Connexion"}
                </h2>

                {!preview.needsRegistration ? (
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Email</span>
                    <input
                      className={styles.input}
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </label>
                ) : (
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
                )}

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Mot de passe</span>
                  <input
                    className={styles.input}
                    type="password"
                    autoComplete={preview.needsRegistration ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={preview.needsRegistration ? 8 : 1}
                    required
                  />
                </label>

                {preview.needsRegistration ? (
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
                ) : null}
              </section>

              {preview.needsRegistration ? (
                <section className={styles.card} aria-labelledby="accept-consent-title">
                  <h2 className={styles.cardTitle} id="accept-consent-title">
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
              ) : null}

              {formError ? <p className={styles.error}>{formError}</p> : null}

              <button type="submit" className={styles.primaryButton} disabled={submitting}>
                {submitting
                  ? "Traitement…"
                  : preview.needsRegistration
                    ? "Créer mon compte et accepter"
                    : "Accepter le devis"}
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
