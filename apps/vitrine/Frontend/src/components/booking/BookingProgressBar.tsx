import styles from "./booking.module.css";

const STEPS = [
  { id: "space", label: "Espace" },
  { id: "services", label: "Services" },
  { id: "account", label: "Compte" },
  { id: "summary", label: "Récapitulatif" },
  { id: "payment", label: "Paiement" },
] as const;

export function BookingProgressBar() {
  return (
    <ol className={styles.progressBar} aria-label="Étapes de réservation">
      {STEPS.map((step, index) => (
        <li
          key={step.id}
          className={[styles.progressStep, index === 0 ? styles.progressStepActive : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <span className={styles.progressIndex}>{index + 1}</span>
          <span className={styles.progressLabel}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
