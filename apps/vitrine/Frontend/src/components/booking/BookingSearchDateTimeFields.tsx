"use client";

import {
  formatShortFrenchDate,
  defaultSearchEndTime,
  type BookingDateRangeInputMode,
} from "@/lib/booking-date-utils";

import styles from "./booking.module.css";

interface BookingSearchDateTimeFieldsProps {
  mode: BookingDateRangeInputMode;
  startDate: Date | null;
  endDate: Date | null;
  startTime: string;
  endTime: string;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
}

export function BookingSearchDateTimeFields({
  mode,
  startDate,
  endDate,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
}: BookingSearchDateTimeFieldsProps) {
  if (mode === "incomplete" || !startDate || !endDate) {
    return null;
  }

  if (mode === "monthly") {
    return (
      <div className={styles.rangeModePanel} role="status">
        <p className={styles.rangeModeHelp}>
          Accès selon les horaires de l&apos;espace pendant toute la durée de l&apos;abonnement.
        </p>
        <p className={styles.rangeModeDates}>
          Du {formatShortFrenchDate(startDate)} au {formatShortFrenchDate(endDate)}
        </p>
      </div>
    );
  }

  if (mode === "short_stay") {
    return (
      <div className={styles.rangeModePanel}>
        <p className={styles.rangeModeHelp}>
          Accès quotidien selon les horaires d&apos;ouverture de l&apos;espace entre ces deux dates.
        </p>
        <div className={styles.timeRow}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Heure d&apos;arrivée</span>
            <span className={styles.fieldHint}>Le {formatShortFrenchDate(startDate)}</span>
            <input
              className={styles.fieldInput}
              type="time"
              value={startTime}
              onChange={(event) => onStartTimeChange(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Heure de départ</span>
            <span className={styles.fieldHint}>Le {formatShortFrenchDate(endDate)}</span>
            <input
              className={styles.fieldInput}
              type="time"
              value={endTime}
              onChange={(event) => onEndTimeChange(event.target.value)}
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.timeRow}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Heure de début</span>
        <input
          className={styles.fieldInput}
          type="time"
          value={startTime}
          onChange={(event) => {
            onStartTimeChange(event.target.value);
            onEndTimeChange(defaultSearchEndTime(event.target.value));
          }}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Heure de fin</span>
        <input
          className={styles.fieldInput}
          type="time"
          value={endTime}
          onChange={(event) => onEndTimeChange(event.target.value)}
        />
      </label>
    </div>
  );
}
