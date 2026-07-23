import type { ReactNode } from "react";

import { useCountUp } from "../../../hooks/useCountUp.js";
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

type ParsedStatValue =
  { kind: "integer"; target: number } | { kind: "currency"; targetCents: number } | { kind: "raw" };

function parseStatValue(value: string): ParsedStatValue {
  const trimmed = value.trim();
  const currency = /^(\d+),(\d{2})\s*€$/.exec(trimmed);
  if (currency) {
    const euros = Number(currency[1]);
    const cents = Number(currency[2]);
    return { kind: "currency", targetCents: euros * 100 + cents };
  }
  if (/^\d+$/.test(trimmed)) {
    return { kind: "integer", target: Number(trimmed) };
  }
  return { kind: "raw" };
}

function formatEuroFromCents(cents: number): string {
  const rounded = Math.max(0, Math.round(cents));
  return `${(rounded / 100).toFixed(2).replace(".", ",")} €`;
}

function DefaultStatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 9h10M7 13h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function BillingStatValue({ value, loading }: { value: string; loading: boolean }) {
  const parsed = parseStatValue(value);
  const animate = !loading && parsed.kind !== "raw";
  const target =
    parsed.kind === "currency" ? parsed.targetCents : parsed.kind === "integer" ? parsed.target : 0;
  const animated = useCountUp(target, { enabled: animate });

  let display: string;
  if (loading) {
    display = "—";
  } else if (parsed.kind === "currency") {
    display = formatEuroFromCents(animated);
  } else if (parsed.kind === "integer") {
    display = String(Math.round(animated));
  } else {
    display = value;
  }

  return (
    <p className={[styles.value, loading ? styles.valueLoading : ""].filter(Boolean).join(" ")}>
      {display}
    </p>
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
            <BillingStatValue value={item.value} loading={loading} />
          </div>
        </article>
      ))}
    </section>
  );
}
