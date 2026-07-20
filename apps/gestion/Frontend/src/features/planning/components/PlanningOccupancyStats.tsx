import type { PlanningOccupancyResponse } from "@coworkprysme/shared";
import {
  IconCalendar,
  IconCalendarMonth,
  IconCalendarWeek,
  IconClockHour4,
} from "@tabler/icons-react";

import styles from "./PlanningOccupancyStats.module.css";

interface PlanningOccupancyStatsProps {
  occupancy: PlanningOccupancyResponse | null;
  loading?: boolean;
}

const CARDS = [
  {
    key: "current" as const,
    label: "Occupation actuelle",
    accent: "var(--planning-slate, #3b6fa8)",
    Icon: IconClockHour4,
  },
  {
    key: "day" as const,
    label: "Occupation du jour",
    accent: "var(--color-primary)",
    Icon: IconCalendar,
  },
  {
    key: "week" as const,
    label: "Occupation de la semaine",
    accent: "var(--color-secondary)",
    Icon: IconCalendarWeek,
  },
  {
    key: "month" as const,
    label: "Occupation du mois",
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
      {CARDS.map(({ key, label, accent, Icon }) => {
        const metric = occupancy?.[key];
        const period = metric?.periodLabel;
        return (
          <article key={key} className={styles.card} style={{ ["--accent" as string]: accent }}>
            <div className={styles.iconWrap}>
              <Icon size={22} stroke={1.75} aria-hidden />
            </div>
            <div className={styles.content}>
              <p className={styles.label}>{label}</p>
              {period ? <p className={styles.period}>{period}</p> : null}
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
