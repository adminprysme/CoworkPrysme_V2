"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  addDays,
  addMonths,
  buildMonthGrid,
  formatDayKey,
  formatMonthLabel,
  isBeforeDay,
  isDayInRange,
  isPastDay,
  isSameDay,
  startOfDay,
  WEEKDAY_LABELS,
} from "@/lib/booking-date-utils";

import styles from "./BookingSearchDateRangePicker.module.css";

interface BookingSearchDateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onRangeChange: (start: Date | null, end: Date | null) => void;
}

function MonthGrid({
  monthDate,
  startDate,
  endDate,
  focusedDay,
  onDayClick,
  onDayFocus,
  panelClassName,
}: {
  monthDate: Date;
  startDate: Date | null;
  endDate: Date | null;
  focusedDay: Date | null;
  onDayClick: (day: Date) => void;
  onDayFocus: (day: Date) => void;
  panelClassName?: string;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const cells = useMemo(
    () => buildMonthGrid(monthDate.getFullYear(), monthDate.getMonth()),
    [monthDate],
  );

  return (
    <div className={[styles.monthPanel, panelClassName].filter(Boolean).join(" ")}>
      <h3 className={styles.monthTitle}>{formatMonthLabel(monthDate)}</h3>
      <div className={styles.weekdayRow} aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className={styles.weekday}>
            {label}
          </span>
        ))}
      </div>
      <div className={styles.daysGrid} role="rowgroup">
        {cells.map((day, index) => {
          if (!day) {
            return (
              <div key={`empty-${index}`} className={styles.dayCellEmpty} role="presentation" />
            );
          }

          const past = isPastDay(day, today);
          const selectedStart = startDate ? isSameDay(day, startDate) : false;
          const selectedEnd = endDate ? isSameDay(day, endDate) : false;
          const inRange = isDayInRange(day, startDate, endDate);
          const isRangeStart =
            selectedStart &&
            endDate !== null &&
            startDate !== null &&
            !isSameDay(startDate, endDate);
          const isRangeEnd =
            selectedEnd && startDate !== null && endDate !== null && !isSameDay(startDate, endDate);
          const isSingleDay = selectedStart && selectedEnd;

          const dayClassName = [
            styles.dayCell,
            inRange ? styles.dayInRange : "",
            isRangeStart ? styles.dayRangeStart : "",
            isRangeEnd ? styles.dayRangeEnd : "",
            isSingleDay ? styles.dayRangeSingle : "",
          ]
            .filter(Boolean)
            .join(" ");

          const buttonClassName = [
            styles.dayButton,
            past ? styles.dayPast : "",
            selectedStart || selectedEnd ? styles.daySelected : "",
          ]
            .filter(Boolean)
            .join(" ");

          const label = day.toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          });

          return (
            <div key={formatDayKey(day)} className={dayClassName} role="presentation">
              <button
                type="button"
                role="gridcell"
                className={buttonClassName}
                disabled={past}
                tabIndex={focusedDay && isSameDay(day, focusedDay) ? 0 : -1}
                aria-label={label}
                aria-selected={selectedStart || selectedEnd || inRange}
                aria-disabled={past}
                onClick={() => onDayClick(day)}
                onFocus={() => onDayFocus(day)}
              >
                {day.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BookingSearchDateRangePicker({
  startDate,
  endDate,
  onRangeChange,
}: BookingSearchDateRangePickerProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfDay(new Date()));
  const [focusedDay, setFocusedDay] = useState<Date | null>(() => startOfDay(new Date()));

  const secondMonth = useMemo(() => addMonths(visibleMonth, 1), [visibleMonth]);

  const rangeSummary = useMemo(() => {
    if (!startDate) {
      return "Sélectionnez une date de début.";
    }
    if (!endDate) {
      return `Début : ${startDate.toLocaleDateString("fr-FR")} — choisissez la date de fin.`;
    }
    if (isSameDay(startDate, endDate)) {
      return `Date sélectionnée : ${startDate.toLocaleDateString("fr-FR")}.`;
    }
    return `Du ${startDate.toLocaleDateString("fr-FR")} au ${endDate.toLocaleDateString("fr-FR")}.`;
  }, [startDate, endDate]);

  const handleDayClick = useCallback(
    (day: Date) => {
      if (isPastDay(day)) {
        return;
      }

      if (!startDate || (startDate && endDate)) {
        onRangeChange(day, null);
        return;
      }

      if (isBeforeDay(day, startDate)) {
        onRangeChange(day, startDate);
        return;
      }

      onRangeChange(startDate, day);
    },
    [endDate, onRangeChange, startDate],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!focusedDay) {
        return;
      }

      let nextDay: Date | null = null;
      switch (event.key) {
        case "ArrowLeft":
          nextDay = addDays(focusedDay, -1);
          break;
        case "ArrowRight":
          nextDay = addDays(focusedDay, 1);
          break;
        case "ArrowUp":
          nextDay = addDays(focusedDay, -7);
          break;
        case "ArrowDown":
          nextDay = addDays(focusedDay, 7);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          handleDayClick(focusedDay);
          return;
        default:
          return;
      }

      event.preventDefault();
      if (!nextDay || isPastDay(nextDay)) {
        return;
      }

      setFocusedDay(nextDay);
      if (
        nextDay.getMonth() !== visibleMonth.getMonth() ||
        nextDay.getFullYear() !== visibleMonth.getFullYear()
      ) {
        setVisibleMonth(new Date(nextDay.getFullYear(), nextDay.getMonth(), 1));
      }
    },
    [focusedDay, handleDayClick, visibleMonth],
  );

  useEffect(() => {
    if (startDate) {
      setVisibleMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
      setFocusedDay(startDate);
    }
  }, [startDate]);

  return (
    <div className={styles.bookingSearchCalendar}>
      <p className={styles.rangeSummary} aria-live="polite">
        {rangeSummary}
      </p>

      <div className={styles.calendarHeader}>
        <button
          type="button"
          className={styles.navButton}
          aria-label="Mois précédent"
          onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
        >
          ←
        </button>
        <span className={styles.srOnly} id="booking-search-calendar-label">
          Calendrier de recherche Parcours A
        </span>
        <button
          type="button"
          className={styles.navButton}
          aria-label="Mois suivant"
          onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
        >
          →
        </button>
      </div>

      <div
        className={styles.monthsRow}
        role="grid"
        aria-labelledby="booking-search-calendar-label"
        onKeyDown={handleKeyDown}
      >
        <MonthGrid
          monthDate={visibleMonth}
          startDate={startDate}
          endDate={endDate}
          focusedDay={focusedDay}
          onDayClick={handleDayClick}
          onDayFocus={setFocusedDay}
        />
        <MonthGrid
          monthDate={secondMonth}
          startDate={startDate}
          endDate={endDate}
          focusedDay={focusedDay}
          onDayClick={handleDayClick}
          onDayFocus={setFocusedDay}
          panelClassName={styles.monthPanelSecond}
        />
      </div>
    </div>
  );
}
