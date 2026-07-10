import styles from "./VitrineMarqueeField.module.css";

interface VitrineMarqueeFieldProps {
  enabled: boolean;
  text: string;
  saving: boolean;
  dirty: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onTextChange: (text: string) => void;
  onSave: () => void;
}

export function VitrineMarqueeField({
  enabled,
  text,
  saving,
  dirty,
  onEnabledChange,
  onTextChange,
  onSave,
}: VitrineMarqueeFieldProps) {
  return (
    <div className={styles.section}>
      <p className={styles.intro}>
        Texte affiché sous la barre de recherche (ex. annonce tramway T9). Le bandeau défile en
        continu lorsqu&apos;il est activé.
      </p>

      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Visibilité</h3>
          <p className={styles.hint}>Contrôle l&apos;affichage sur le site public.</p>
        </div>
        <div className={styles.toggle} role="group" aria-label="Afficher le bandeau">
          <button
            type="button"
            className={[styles.toggleOption, enabled ? styles.toggleOptionSelected : ""]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={enabled}
            onClick={() => onEnabledChange(true)}
          >
            Visible
          </button>
          <button
            type="button"
            className={[styles.toggleOption, !enabled ? styles.toggleOptionSelectedOff : ""]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={!enabled}
            onClick={() => onEnabledChange(false)}
          >
            Masqué
          </button>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="marquee-text">
          Texte du bandeau
        </label>
        <textarea
          id="marquee-text"
          className={styles.textarea}
          value={text}
          disabled={!enabled}
          maxLength={500}
          placeholder="Ex. Le Tramway T9 arrive au pied de l'immeuble à la fin de l'automne 2026"
          onChange={(event) => onTextChange(event.target.value)}
        />
        <p className={styles.charCount}>{text.length} / 500</p>
      </div>

      {enabled && text.trim().length > 0 ? (
        <div className={styles.previewMarquee} aria-hidden="true">
          <span className={styles.previewMarqueeTrack}>{text.trim()}</span>
        </div>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={saving || text.trim().length === 0 || !dirty}
          onClick={onSave}
        >
          {saving ? "Enregistrement…" : "Enregistrer le bandeau"}
        </button>
      </div>
    </div>
  );
}
