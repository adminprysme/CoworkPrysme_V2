import type { PlanningOccupancyResponse } from "@coworkprysme/shared";
import { IconCalendar, IconCalendarMonth, IconCalendarWeek } from "@tabler/icons-react";

import { compactOccupancyPeriodLabel } from "../planning-occupancy-label.js";
import styles from "./PlanningOccupancyStats.module.css";

interface PlanningOccupancyStatsProps {
  occupancy: PlanningOccupancyResponse | null;
  loading?: boolean;
}

const CARDS = [
  {
    key: "day" as const,
    label: "Occupation du jour",
    shortLabel: "Jour",
    accent: "var(--color-primary)",
    Icon: IconCalendar,
  },
  {
    key: "week" as const,
    label: "Occupation de la semaine",
    shortLabel: "Semaine",
    accent: "var(--color-secondary)",
    Icon: IconCalendarWeek,
  },
  {
    key: "month" as const,
    label: "Occupation du mois",
    shortLabel: "Mois",
    accent: "var(--color-primary)",
    Icon: IconCalendarMonth,
  },
] as const;

export function PlanningOccupancyStats({
  occupancy,
  loading = false,
}: PlanningOccupancyStatsProps) {
  return (
    <section className={styles.grid} aria-label="Taux d'occupation">
      {CARDS.map(({ key, label, shortLabel, accent, Icon }) => {
        const metric = occupancy?.[key];
        const period = metric?.periodLabel;
        const compactPeriod = period ? compactOccupancyPeriodLabel(key, period) : null;
        return (
          <article key={key} className={styles.card} style={{ ["--accent" as string]: accent }}>
            <div className={styles.iconWrap}>
              <Icon size={22} stroke={1.75} aria-hidden />
            </div>
            <div className={styles.content}>
              <p className={styles.label}>
                <span className={styles.labelFull}>{label}</span>
                <span className={styles.labelShort}>{shortLabel}</span>
              </p>
              {period ? (
                <p className={styles.period}>
                  <span className={styles.periodFull}>{period}</span>
                  <span className={styles.periodShort}>{compactPeriod}</span>
                </p>
              ) : null}
              <p
                className={[styles.value, loading || !metric ? styles.valueLoading : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                {loading || !metric ? "—" : `${metric.rate} %`}
              </p>
            </div>
          </article>
        );
      })}
    </section>
  );
}
