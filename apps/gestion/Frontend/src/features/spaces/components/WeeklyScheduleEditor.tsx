import type { ReactNode } from "react";

import type { DaySchedule } from "../types.js";
import { WEEK_DAY_LABELS } from "../types.js";
import { copyDayScheduleToAll } from "../utils/schedule.js";
import styles from "./WeeklyScheduleEditor.module.css";

interface WeeklyScheduleEditorProps {
  idPrefix: string;
  title: string;
  schedules: DaySchedule[];
  onChange: (schedules: DaySchedule[]) => void;
  disabled?: boolean;
  headerExtra?: ReactNode;
}

export function WeeklyScheduleEditor({
  idPrefix,
  title,
  schedules,
  onChange,
  disabled = false,
  headerExtra,
}: WeeklyScheduleEditorProps) {
  function updateDay(day: DaySchedule["day"], patch: Partial<DaySchedule>) {
    onChange(schedules.map((entry) => (entry.day === day ? { ...entry, ...patch } : entry)));
  }

  function copyFromDay(source: DaySchedule) {
    onChange(copyDayScheduleToAll(source, schedules));
  }

  const monday = schedules.find((entry) => entry.day === "monday");

  return (
    <section className={styles.schedule} aria-labelledby={`${idPrefix}-title`}>
      <div className={styles.scheduleHeader}>
        <h3 id={`${idPrefix}-title`}>{title}</h3>
        <div className={styles.headerActions}>
          {headerExtra}
          {monday ? (
            <button
              type="button"
              className={styles.copyAllBtn}
              disabled={disabled}
              onClick={() => copyFromDay(monday)}
            >
              Appliquer le lundi à tous
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.table}>
        <div className={styles.tableHead} aria-hidden="true">
          <span>Jour</span>
          <span>Horaires</span>
          <span>24h/24</span>
        </div>

        {schedules.map((entry) => (
          <div
            key={entry.day}
            className={[styles.row, disabled ? styles.rowDisabled : ""].filter(Boolean).join(" ")}
          >
            <span className={styles.dayLabel}>{WEEK_DAY_LABELS[entry.day]}</span>

            <div className={styles.times}>
              {entry.is24h ? (
                <span className={styles.allDay}>Ouvert en continu</span>
              ) : (
                <div className={styles.timeRange}>
                  <label className={styles.timeField} htmlFor={`${idPrefix}-${entry.day}-open`}>
                    <span className={styles.timeFieldLabel}>De</span>
                    <input
                      id={`${idPrefix}-${entry.day}-open`}
                      type="time"
                      className={styles.timeInput}
                      value={entry.openTime}
                      disabled={disabled}
                      onChange={(event) => updateDay(entry.day, { openTime: event.target.value })}
                    />
                  </label>
                  <label className={styles.timeField} htmlFor={`${idPrefix}-${entry.day}-close`}>
                    <span className={styles.timeFieldLabel}>À</span>
                    <input
                      id={`${idPrefix}-${entry.day}-close`}
                      type="time"
                      className={styles.timeInput}
                      value={entry.closeTime}
                      disabled={disabled}
                      onChange={(event) => updateDay(entry.day, { closeTime: event.target.value })}
                    />
                  </label>
                </div>
              )}
            </div>

            <label className={styles.toggle24h}>
              <input
                type="checkbox"
                checked={entry.is24h}
                disabled={disabled}
                onChange={(event) => updateDay(entry.day, { is24h: event.target.checked })}
              />
              <span className={styles.toggle24hText}>24h/24</span>
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}
