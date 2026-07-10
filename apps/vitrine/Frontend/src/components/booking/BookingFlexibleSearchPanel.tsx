"use client";

import { useMemo, useRef } from "react";

import {
  FLEXIBLE_DURATION_OPTIONS,
  formatMonthCardLabel,
  isSameMonth,
  upcomingMonths,
  type BookingFlexibleDuration,
} from "@/lib/booking-date-utils";

import styles from "./BookingFlexibleSearchPanel.module.css";

interface BookingFlexibleSearchPanelProps {
  duration: BookingFlexibleDuration | null;
  onDurationChange: (duration: BookingFlexibleDuration) => void;
  selectedMonth: Date | null;
  onMonthChange: (month: Date) => void;
}

export function BookingFlexibleSearchPanel({
  duration,
  onDurationChange,
  selectedMonth,
  onMonthChange,
}: BookingFlexibleSearchPanelProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const months = useMemo(() => upcomingMonths(12), []);

  function scrollTrack(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    track.scrollBy({ left: direction * 260, behavior: "smooth" });
  }

  return (
    <div className={styles.flexiblePanel}>
      <section className={styles.section} aria-labelledby="flexible-duration-title">
        <h3 id="flexible-duration-title" className={styles.sectionTitle}>
          Quelle sera la durée de votre réservation ?
        </h3>
        <div className={styles.durationPills} role="group" aria-label="Durée de réservation">
          {FLEXIBLE_DURATION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={[
                styles.durationPill,
                duration === option.value ? styles.durationPillActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={duration === option.value}
              onClick={() => onDurationChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="flexible-month-title">
        <div className={styles.monthHeader}>
          <h3 id="flexible-month-title" className={styles.sectionTitle}>
            Quand souhaitez-vous réserver ?
          </h3>
          <div>
            <button
              type="button"
              className={styles.monthNavButton}
              aria-label="Faire défiler les mois vers la gauche"
              onClick={() => scrollTrack(-1)}
            >
              ←
            </button>
            <button
              type="button"
              className={styles.monthNavButton}
              aria-label="Faire défiler les mois vers la droite"
              onClick={() => scrollTrack(1)}
            >
              →
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          className={styles.monthTrack}
          role="listbox"
          aria-label="Mois de réservation"
        >
          {months.map((month) => {
            const { month: monthLabel, year } = formatMonthCardLabel(month);
            const active = selectedMonth ? isSameMonth(month, selectedMonth) : false;
            return (
              <button
                key={`${month.getFullYear()}-${month.getMonth()}`}
                type="button"
                role="option"
                aria-selected={active}
                className={[styles.monthCard, active ? styles.monthCardActive : ""]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onMonthChange(month)}
              >
                <span className={styles.monthCardMonth}>{monthLabel}</span>
                <span className={styles.monthCardYear}>{year}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
