import styles from "./BookingRecurringReservationHint.module.css";

interface BookingRecurringReservationHintProps {
  mailto: string;
  compact?: boolean;
}

export function BookingRecurringReservationHint({
  mailto,
  compact = false,
}: BookingRecurringReservationHintProps) {
  return (
    <p className={[styles.recurringHint, compact ? styles.recurringHintCompact : ""].join(" ")}>
      Besoin d&apos;une réservation récurrente (ex. tous les lundis pendant plusieurs semaines) ?{" "}
      <a className={styles.recurringLink} href={mailto}>
        Contactez notre équipe
      </a>
    </p>
  );
}
