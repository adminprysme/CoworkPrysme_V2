"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { checkBookingEmail, verifyBookingAccount } from "@/lib/booking-confirm-api";

import styles from "./BookingTunnelStep.module.css";

export type BookingAccountFormState = {
  mode: "new" | "existing";
  email: string;
  password: string;
  passwordConfirm: string;
  firstName: string;
  lastName: string;
  phone: string;
  privacyAccepted: boolean;
  verified: boolean;
};

interface BookingAccountStepProps {
  value: BookingAccountFormState;
  onChange: (value: BookingAccountFormState) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function BookingAccountStep({
  value,
  onChange,
  onBack,
  onContinue,
}: BookingAccountStepProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [existingEmailHint, setExistingEmailHint] = useState(false);

  useEffect(() => {
    if (value.mode !== "new" || !value.email.includes("@")) {
      setExistingEmailHint(false);
      return;
    }

    const handle = window.setTimeout(() => {
      void checkBookingEmail(value.email)
        .then((exists) => setExistingEmailHint(exists))
        .catch(() => setExistingEmailHint(false));
    }, 350);

    return () => window.clearTimeout(handle);
  }, [value.email, value.mode]);

  function patch(partial: Partial<BookingAccountFormState>) {
    onChange({ ...value, ...partial, verified: false });
    setError(null);
  }

  async function handleContinue() {
    setError(null);

    if (!value.email.trim()) {
      setError("L'adresse email est requise.");
      return;
    }

    if (value.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (value.mode === "new") {
      if (value.password !== value.passwordConfirm) {
        setError("Les mots de passe ne correspondent pas.");
        return;
      }
      if (!value.firstName.trim() || !value.lastName.trim()) {
        setError("Le prénom et le nom sont requis.");
        return;
      }
      if (!value.privacyAccepted) {
        setError("Vous devez accepter la politique de confidentialité.");
        return;
      }
      if (existingEmailHint) {
        setError("Un compte existe déjà avec cette adresse. Connectez-vous.");
        return;
      }
      onChange({ ...value, verified: true });
      onContinue();
      return;
    }

    setLoading(true);
    try {
      const valid = await verifyBookingAccount(value.email, value.password);
      if (!valid) {
        setError("Email ou mot de passe incorrect.");
        return;
      }
      onChange({ ...value, verified: true });
      onContinue();
    } catch {
      setError("Email ou mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.step}>
      <div className={styles.stepHeader}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← Retour
        </button>
        <div>
          <h2 className={styles.title}>Votre compte</h2>
          <p className={styles.lead}>
            {value.mode === "new"
              ? "Créez votre compte client — il sera activé à la validation finale."
              : "Connectez-vous pour finaliser votre réservation."}
          </p>
        </div>
      </div>

      <div className={styles.form}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Email</span>
          <input
            className={styles.input}
            type="email"
            autoComplete={value.mode === "new" ? "email" : "username"}
            value={value.email}
            onChange={(event) => patch({ email: event.target.value })}
          />
        </label>

        {existingEmailHint && value.mode === "new" ? (
          <p className={[styles.notice, styles.noticeWarning].join(" ")}>
            Un compte existe déjà avec cette adresse.{" "}
            <button
              type="button"
              className={styles.modeSwitch}
              onClick={() => patch({ mode: "existing" })}
            >
              Se connecter
            </button>
          </p>
        ) : null}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Mot de passe</span>
          <input
            className={styles.input}
            type="password"
            autoComplete={value.mode === "new" ? "new-password" : "current-password"}
            value={value.password}
            onChange={(event) => patch({ password: event.target.value })}
          />
        </label>

        {value.mode === "new" ? (
          <>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Confirmer le mot de passe</span>
              <input
                className={styles.input}
                type="password"
                autoComplete="new-password"
                value={value.passwordConfirm}
                onChange={(event) => patch({ passwordConfirm: event.target.value })}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Prénom</span>
              <input
                className={styles.input}
                type="text"
                autoComplete="given-name"
                value={value.firstName}
                onChange={(event) => patch({ firstName: event.target.value })}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Nom</span>
              <input
                className={styles.input}
                type="text"
                autoComplete="family-name"
                value={value.lastName}
                onChange={(event) => patch({ lastName: event.target.value })}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Téléphone (optionnel)</span>
              <input
                className={styles.input}
                type="tel"
                autoComplete="tel"
                value={value.phone}
                onChange={(event) => patch({ phone: event.target.value })}
              />
            </label>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={value.privacyAccepted}
                onChange={(event) => patch({ privacyAccepted: event.target.checked })}
              />
              <span>
                J&apos;accepte la{" "}
                <Link href="/politique-de-confidentialite" className={styles.link}>
                  politique de confidentialité
                </Link>
                .
              </span>
            </label>
          </>
        ) : null}

        {value.verified ? <p className={styles.success}>Identifiants vérifiés.</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={loading}
            onClick={() => void handleContinue()}
          >
            {loading ? "Vérification…" : "Continuer"}
          </button>
        </div>

        <p>
          {value.mode === "new" ? (
            <>
              Vous avez déjà un compte ?{" "}
              <button
                type="button"
                className={styles.modeSwitch}
                onClick={() => patch({ mode: "existing" })}
              >
                Se connecter
              </button>
            </>
          ) : (
            <>
              Nouveau client ?{" "}
              <button
                type="button"
                className={styles.modeSwitch}
                onClick={() => patch({ mode: "new" })}
              >
                Créer un compte
              </button>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
