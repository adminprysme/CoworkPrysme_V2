import styles from "./VitrineSiteContactField.module.css";

interface VitrineSiteContactFieldProps {
  email: string;
  phone: string;
  saving: boolean;
  dirty: boolean;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSave: () => void;
}

export function VitrineSiteContactField({
  email,
  phone,
  saving,
  dirty,
  onEmailChange,
  onPhoneChange,
  onSave,
}: VitrineSiteContactFieldProps) {
  return (
    <div className={styles.section}>
      <p className={styles.hint}>
        E-mail et téléphone visibles dans le pied de page et sur la page Contact du site vitrine.
        Les coordonnées du bâtiment restent réservées à l&apos;espace client.
      </p>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="vitrine-contact-email">
            E-mail
          </label>
          <input
            id="vitrine-contact-email"
            type="email"
            className={styles.input}
            value={email}
            maxLength={254}
            placeholder="contact@prysme.eu"
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="vitrine-contact-phone">
            Téléphone
          </label>
          <input
            id="vitrine-contact-phone"
            type="tel"
            className={styles.input}
            value={phone}
            maxLength={32}
            placeholder="04 78 86 92 55"
            onChange={(event) => onPhoneChange(event.target.value)}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={saving || !dirty || email.trim().length === 0 || phone.trim().length === 0}
          onClick={onSave}
        >
          {saving ? "Enregistrement…" : "Enregistrer les coordonnées"}
        </button>
      </div>
    </div>
  );
}
