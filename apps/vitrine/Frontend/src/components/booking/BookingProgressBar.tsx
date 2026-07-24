import styles from "./BookingProgressBar.module.css";

export type BookingProgressStepId = "space" | "services" | "account" | "summary" | "payment";

const STEPS = [
  { id: "space", label: "Espace" },
  { id: "services", label: "Services" },
  { id: "account", label: "Compte" },
  { id: "summary", label: "Récapitulatif" },
  { id: "payment", label: "Paiement" },
] as const satisfies ReadonlyArray<{ id: BookingProgressStepId; label: string }>;

interface BookingProgressBarProps {
  activeStep: BookingProgressStepId;
}

export function BookingProgressBar({ activeStep }: BookingProgressBarProps) {
  const activeIndex = STEPS.findIndex((step) => step.id === activeStep);

  return (
    <ol className={styles.progressBar} aria-label="Étapes de réservation">
      {STEPS.map((step, index) => {
        const isActive = index === activeIndex;
        const isComplete = index < activeIndex;

        return (
          <li
            key={step.id}
            className={[
              styles.progressStep,
              isActive ? styles.progressStepActive : "",
              isComplete ? styles.progressStepComplete : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className={styles.progressIndex}>{index + 1}</span>
            <span className={styles.progressLabel}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export { STEPS as BOOKING_PROGRESS_STEPS };
