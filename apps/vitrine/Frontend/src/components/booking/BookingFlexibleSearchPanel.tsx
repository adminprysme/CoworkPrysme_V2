"use client";

import { useCallback, useMemo, useRef } from "react";

import {
  FLEXIBLE_DURATION_OPTIONS,
  formatFlexibleMonthSelection,
  formatMonthCardLabel,
  isBeforeMonth,
  isMonthInRange,
  isSameMonth,
  upcomingMonths,
  type BookingFlexibleDuration,
} from "@/lib/booking-date-utils";

import styles from "./BookingFlexibleSearchPanel.module.css";

interface BookingFlexibleSearchPanelProps {
  duration: BookingFlexibleDuration | null;
  onDurationChange: (duration: BookingFlexibleDuration) => void;
  selectedStartMonth: Date | null;
  selectedEndMonth: Date | null;
  onMonthRangeChange: (start: Date | null, end: Date | null) => void;
}

export function BookingFlexibleSearchPanel({
  duration,
  onDurationChange,
  selectedStartMonth,
  selectedEndMonth,
  onMonthRangeChange,
}: BookingFlexibleSearchPanelProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const months = useMemo(() => upcomingMonths(12), []);
  const allowMonthRange = duration === "month_plus";

  const monthSummary = useMemo(
    () => formatFlexibleMonthSelection(selectedStartMonth, selectedEndMonth, allowMonthRange),
    [allowMonthRange, selectedEndMonth, selectedStartMonth],
  );

  function scrollTrack(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    track.scrollBy({ left: direction * 260, behavior: "smooth" });
  }

  const handleMonthClick = useCallback(
    (month: Date) => {
      if (!allowMonthRange) {
        onMonthRangeChange(month, month);
        return;
      }

      if (!selectedStartMonth || (selectedStartMonth && selectedEndMonth)) {
        onMonthRangeChange(month, null);
        return;
      }

      if (isBeforeMonth(month, selectedStartMonth)) {
        onMonthRangeChange(month, selectedStartMonth);
        return;
      }

      onMonthRangeChange(selectedStartMonth, month);
    },
    [allowMonthRange, onMonthRangeChange, selectedEndMonth, selectedStartMonth],
  );

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
          <div className={styles.monthHeaderText}>
            <h3 id="flexible-month-title" className={styles.sectionTitle}>
              Quand souhaitez-vous réserver ?
            </h3>
            {allowMonthRange ? (
              <p className={styles.monthSummary} aria-live="polite">
                {monthSummary}
              </p>
            ) : null}
          </div>
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
          aria-multiselectable={allowMonthRange}
        >
          {months.map((month) => {
            const { month: monthLabel, year } = formatMonthCardLabel(month);
            const selectedStart = selectedStartMonth
              ? isSameMonth(month, selectedStartMonth)
              : false;
            const selectedEnd = selectedEndMonth ? isSameMonth(month, selectedEndMonth) : false;
            const inRange = isMonthInRange(month, selectedStartMonth, selectedEndMonth);
            const isRangeStart =
              selectedStart &&
              selectedEndMonth !== null &&
              selectedStartMonth !== null &&
              !isSameMonth(selectedStartMonth, selectedEndMonth);
            const isRangeEnd =
              selectedEnd &&
              selectedStartMonth !== null &&
              selectedEndMonth !== null &&
              !isSameMonth(selectedStartMonth, selectedEndMonth);
            const isSingleMonth = selectedStart && selectedEnd;

            return (
              <button
                key={`${month.getFullYear()}-${month.getMonth()}`}
                type="button"
                role="option"
                aria-selected={selectedStart || selectedEnd || inRange}
                className={[
                  styles.monthCard,
                  inRange ? styles.monthCardInRange : "",
                  isRangeStart ? styles.monthCardRangeStart : "",
                  isRangeEnd ? styles.monthCardRangeEnd : "",
                  isSingleMonth ? styles.monthCardRangeSingle : "",
                  selectedStart || selectedEnd ? styles.monthCardActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => handleMonthClick(month)}
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
