import Link from "next/link";

import styles from "./BookingEmptyState.module.css";

type BookingEmptyStateProps = {
  title: string;
  description: string;
  onAdjustSearch?: () => void;
  adjustSearchLabel?: string;
  compact?: boolean;
};

export function BookingEmptyState({
  title,
  description,
  onAdjustSearch,
  adjustSearchLabel = "Modifier la recherche",
  compact = false,
}: BookingEmptyStateProps) {
  return (
    <div
      className={[styles.emptyState, compact ? styles.calendarEmpty : ""].filter(Boolean).join(" ")}
      role="status"
    >
      <p className={styles.title}>{title}</p>
      <p className={styles.description}>{description}</p>
      <div className={styles.actions}>
        {onAdjustSearch ? (
          <button type="button" className={styles.adjustButton} onClick={onAdjustSearch}>
            {adjustSearchLabel}
          </button>
        ) : null}
        <Link href="/contact" className={styles.contactLink}>
          Contactez-nous
        </Link>
      </div>
    </div>
  );
}
