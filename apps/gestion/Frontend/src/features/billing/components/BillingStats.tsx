import type { ReactNode } from "react";

import styles from "./BillingStats.module.css";

export interface BillingStatItem {
  key: string;
  label: string;
  value: string;
  accent?: string;
  icon?: ReactNode;
}

interface BillingStatsProps {
  items: BillingStatItem[];
  loading?: boolean;
  ariaLabel: string;
}

function DefaultStatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 9h10M7 13h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function BillingStats({ items, loading = false, ariaLabel }: BillingStatsProps) {
  const cols3 = items.length === 3;
  return (
    <section
      className={cols3 ? `${styles.grid} ${styles.gridCols3}` : styles.grid}
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <article
          key={item.key}
          className={styles.card}
          style={{
            ["--accent" as string]: item.accent ?? "var(--color-primary)",
          }}
        >
          <div className={styles.iconWrap}>{item.icon ?? <DefaultStatIcon />}</div>
          <div className={styles.content}>
            <p className={styles.label}>{item.label}</p>
            <p
              className={[styles.value, loading ? styles.valueLoading : ""]
                .filter(Boolean)
                .join(" ")}
            >
              {loading ? "—" : item.value}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
