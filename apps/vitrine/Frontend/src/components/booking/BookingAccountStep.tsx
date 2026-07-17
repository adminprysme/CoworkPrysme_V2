"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { BookingClientKind } from "@coworkprysme/shared";

import { checkBookingEmail, verifyBookingAccount } from "@/lib/booking-confirm-api";
import { isValidSiretDigits, lookupCompanyBySiret } from "@/lib/company-lookup";

import { BookingAddressSuggestField } from "./BookingAddressSuggestField";
import styles from "./BookingAccountStep.module.css";

export type BookingAccountFormState = {
  mode: "new" | "existing";
  email: string;
  password: string;
  passwordConfirm: string;
  firstName: string;
  lastName: string;
  phone: string;
  clientKind: BookingClientKind;
  street: string;
  zip: string;
  city: string;
  legalName: string;
  siret: string;
  vatNumber: string;
  privacyAccepted: boolean;
  marketingAccepted: boolean;
  verified: boolean;
};

export const EMPTY_BOOKING_ACCOUNT_FORM: BookingAccountFormState = {
  mode: "new",
  email: "",
  password: "",
  passwordConfirm: "",
  firstName: "",
  lastName: "",
  phone: "",
  clientKind: "individual",
  street: "",
  zip: "",
  city: "",
  legalName: "",
  siret: "",
  vatNumber: "",
  privacyAccepted: false,
  marketingAccepted: false,
  verified: false,
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
  const [siretLookupLoading, setSiretLookupLoading] = useState(false);
  const [siretLookupMessage, setSiretLookupMessage] = useState<string | null>(null);
  const [vatPrefillHint, setVatPrefillHint] = useState(false);

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
    if (partial.siret !== undefined) {
      setSiretLookupMessage(null);
    }
    if (partial.vatNumber !== undefined) {
      setVatPrefillHint(false);
    }
  }

  async function handleSiretLookup() {
    setSiretLookupMessage(null);
    setVatPrefillHint(false);

    if (!isValidSiretDigits(value.siret)) {
      setSiretLookupMessage("Le SIRET doit contenir exactement 14 chiffres.");
      return;
    }

    setSiretLookupLoading(true);
    try {
      const outcome = await lookupCompanyBySiret(value.siret);
      if (outcome.status === "ok") {
        onChange({
          ...value,
          legalName: outcome.company.legalName,
          siret: outcome.company.siret,
          vatNumber: outcome.company.vatNumber,
          street: outcome.company.address.street,
          zip: outcome.company.address.zip,
          city: outcome.company.address.city,
          verified: false,
        });
        setVatPrefillHint(true);
        setSiretLookupMessage(null);
        return;
      }
      if (outcome.status === "invalid_siret") {
        setSiretLookupMessage("Le SIRET doit contenir exactement 14 chiffres.");
        return;
      }
      if (outcome.status === "not_found") {
        setSiretLookupMessage(
          "Aucun établissement trouvé pour ce SIRET. Vérifiez le numéro ou saisissez les informations manuellement.",
        );
        return;
      }
      setSiretLookupMessage(
        "Recherche temporairement indisponible. Vous pouvez saisir les informations manuellement.",
      );
    } finally {
      setSiretLookupLoading(false);
    }
  }

  function validateNewAccount(): string | null {
    if (!value.firstName.trim() || !value.lastName.trim()) {
      return "Le prénom et le nom sont requis.";
    }
    if (!value.street.trim() || !value.zip.trim() || !value.city.trim()) {
      return "L'adresse (rue, code postal, ville) est requise.";
    }
    if (value.clientKind === "company") {
      if (!value.legalName.trim()) {
        return "La raison sociale est requise.";
      }
      const siretDigits = value.siret.replaceAll(/\s/g, "");
      if (siretDigits && !/^\d{14}$/.test(siretDigits)) {
        return "Le SIRET doit contenir exactement 14 chiffres.";
      }
    }
    if (value.password !== value.passwordConfirm) {
      return "Les mots de passe ne correspondent pas.";
    }
    if (!value.privacyAccepted) {
      return "Vous devez accepter la politique de confidentialité.";
    }
    if (existingEmailHint) {
      return "Un compte existe déjà avec cette adresse. Connectez-vous.";
    }
    return null;
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
      const validationError = validateNewAccount();
      if (validationError) {
        setError(validationError);
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
              ? "Créez votre espace client pour finaliser la réservation."
              : "Connectez-vous pour finaliser votre réservation."}
          </p>
        </div>
      </div>

      <div className={styles.infoBanner} role="note">
        <p className={styles.infoBannerTitle}>
          {value.mode === "new" ? "Activation du compte" : "Connexion sécurisée"}
        </p>
        <p className={styles.infoBannerText}>
          {value.mode === "new"
            ? "Votre compte sera créé maintenant et activé définitivement à la validation finale de la réservation."
            : "Utilisez l'email et le mot de passe de votre espace client Cowork Prysme."}
        </p>
      </div>

      <div className={styles.formShell}>
        {value.mode === "new" ? (
          <>
            <section className={styles.sectionCard} aria-labelledby="account-kind-title">
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle} id="account-kind-title">
                  Type de compte
                </h3>
                <p className={styles.sectionHint}>
                  Particulier ou professionnel — détermine les informations de facturation.
                </p>
              </div>

              <div className={styles.kindToggle} role="radiogroup" aria-label="Type de compte">
                <button
                  type="button"
                  role="radio"
                  aria-checked={value.clientKind === "individual"}
                  className={[
                    styles.kindOption,
                    value.clientKind === "individual" ? styles.kindOptionSelected : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => patch({ clientKind: "individual" })}
                >
                  Particulier
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={value.clientKind === "company"}
                  className={[
                    styles.kindOption,
                    value.clientKind === "company" ? styles.kindOptionSelected : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => patch({ clientKind: "company" })}
                >
                  Professionnel
                </button>
              </div>
            </section>

            <section className={styles.sectionCard} aria-labelledby="account-identity-title">
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle} id="account-identity-title">
                  Identité
                </h3>
                <p className={styles.sectionHint}>
                  Pour personnaliser votre fiche client et vos accès.
                </p>
              </div>

              <div className={[styles.fieldGrid, styles.fieldGridTwo].join(" ")}>
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
              </div>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  Téléphone <span className={styles.fieldOptional}>(optionnel)</span>
                </span>
                <input
                  className={styles.input}
                  type="tel"
                  autoComplete="tel"
                  value={value.phone}
                  onChange={(event) => patch({ phone: event.target.value })}
                />
              </label>
            </section>

            {value.clientKind === "company" ? (
              <section className={styles.sectionCard} aria-labelledby="account-company-title">
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle} id="account-company-title">
                    Société
                  </h3>
                  <p className={styles.sectionHint}>
                    Informations figurant sur vos factures professionnelles.
                  </p>
                </div>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Raison sociale</span>
                  <input
                    className={styles.input}
                    type="text"
                    autoComplete="organization"
                    value={value.legalName}
                    onChange={(event) => patch({ legalName: event.target.value })}
                  />
                </label>

                <div className={styles.siretRow}>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>
                      SIRET <span className={styles.fieldOptional}>(optionnel)</span>
                    </span>
                    <input
                      className={styles.input}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="14 chiffres"
                      value={value.siret}
                      onChange={(event) => patch({ siret: event.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className={styles.siretLookupButton}
                    disabled={siretLookupLoading}
                    onClick={() => void handleSiretLookup()}
                  >
                    {siretLookupLoading ? "Recherche…" : "Rechercher"}
                  </button>
                </div>

                {siretLookupMessage ? (
                  <p className={styles.siretLookupMessage} role="status">
                    {siretLookupMessage}
                  </p>
                ) : null}

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>
                    TVA intracom. <span className={styles.fieldOptional}>(optionnel)</span>
                  </span>
                  <input
                    className={styles.input}
                    type="text"
                    autoComplete="off"
                    placeholder="FR…"
                    value={value.vatNumber}
                    onChange={(event) => patch({ vatNumber: event.target.value })}
                  />
                  {vatPrefillHint ? (
                    <span className={styles.fieldHint}>
                      Numéro calculé à partir du SIREN — vérifiez avant validation.
                    </span>
                  ) : null}
                </label>
              </section>
            ) : null}

            <section className={styles.sectionCard} aria-labelledby="account-address-title">
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle} id="account-address-title">
                  {value.clientKind === "company" ? "Adresse de facturation" : "Adresse"}
                </h3>
                <p className={styles.sectionHint}>
                  {value.clientKind === "company"
                    ? "Adresse du siège ou de l'établissement à facturer."
                    : "Adresse postale pour votre fiche client."}
                </p>
              </div>

              <BookingAddressSuggestField
                street={value.street}
                zip={value.zip}
                city={value.city}
                onStreetChange={(street) => patch({ street })}
                onSelect={(suggestion) =>
                  patch({
                    street: suggestion.street,
                    zip: suggestion.zip,
                    city: suggestion.city,
                  })
                }
              />

              <div className={[styles.fieldGrid, styles.fieldGridTwo].join(" ")}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Code postal</span>
                  <input
                    className={styles.input}
                    type="text"
                    autoComplete="postal-code"
                    value={value.zip}
                    onChange={(event) => patch({ zip: event.target.value })}
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Ville</span>
                  <input
                    className={styles.input}
                    type="text"
                    autoComplete="address-level2"
                    value={value.city}
                    onChange={(event) => patch({ city: event.target.value })}
                  />
                </label>
              </div>
            </section>
          </>
        ) : null}

        <section className={styles.sectionCard} aria-labelledby="account-login-title">
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle} id="account-login-title">
              Connexion
            </h3>
            <p className={styles.sectionHint}>
              {value.mode === "new"
                ? "Ces identifiants vous permettront de retrouver vos réservations."
                : "Saisissez vos identifiants existants."}
            </p>
          </div>

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

          <div
            className={[styles.fieldGrid, value.mode === "new" ? styles.fieldGridTwo : ""].join(
              " ",
            )}
          >
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
            ) : null}
          </div>
        </section>

        {value.mode === "new" ? (
          <section className={styles.sectionCard} aria-labelledby="account-consent-title">
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle} id="account-consent-title">
                Consentement
              </h3>
              <p className={styles.sectionHint}>
                Vos choix sont enregistrés avec horodatage pour votre espace client.
              </p>
            </div>

            <label className={[styles.checkboxCard, styles.checkboxCardRequired].join(" ")}>
              <input
                type="checkbox"
                checked={value.privacyAccepted}
                onChange={(event) => patch({ privacyAccepted: event.target.checked })}
              />
              <span className={styles.checkboxCardLabel}>
                <span className={styles.checkboxCardTitle}>Politique de confidentialité</span>
                <span>
                  J&apos;accepte la{" "}
                  <Link href="/politique-de-confidentialite" className={styles.link}>
                    politique de confidentialité
                  </Link>{" "}
                  (obligatoire).
                </span>
              </span>
            </label>

            <label className={styles.checkboxCard}>
              <input
                type="checkbox"
                checked={value.marketingAccepted}
                onChange={(event) => patch({ marketingAccepted: event.target.checked })}
              />
              <span className={styles.checkboxCardLabel}>
                <span className={styles.checkboxCardTitle}>Communications de l&apos;espace</span>
                <span>
                  J&apos;accepte de recevoir des communications de mon espace de coworking
                  (actualités, offres). Facultatif.
                </span>
              </span>
            </label>
          </section>
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

        <div className={styles.modePanel}>
          <p className={styles.modePanelText}>
            {value.mode === "new"
              ? "Vous avez déjà un compte client ?"
              : "Première réservation chez Cowork Prysme ?"}
          </p>
          <button
            type="button"
            className={styles.modeSwitch}
            onClick={() => patch({ mode: value.mode === "new" ? "existing" : "new" })}
          >
            {value.mode === "new" ? "Se connecter" : "Créer un compte"}
          </button>
        </div>
      </div>
    </section>
  );
}
