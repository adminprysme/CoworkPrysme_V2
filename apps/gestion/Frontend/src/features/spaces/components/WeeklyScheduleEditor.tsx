import type { DaySchedule } from "../types.js";
import { WEEK_DAY_LABELS } from "../types.js";
import { copyDayScheduleToAll } from "../utils/schedule.js";
import styles from "./WeeklyScheduleEditor.module.css";

interface WeeklyScheduleEditorProps {
  idPrefix: string;
  title: string;
  schedules: DaySchedule[];
  onChange: (schedules: DaySchedule[]) => void;
}

export function WeeklyScheduleEditor({
  idPrefix,
  title,
  schedules,
  onChange,
}: WeeklyScheduleEditorProps) {
  function updateDay(day: DaySchedule["day"], patch: Partial<DaySchedule>) {
    onChange(schedules.map((entry) => (entry.day === day ? { ...entry, ...patch } : entry)));
  }

  return (
    <section className={styles.schedule} aria-labelledby={`${idPrefix}-title`}>
      <h3 id={`${idPrefix}-title`}>{title}</h3>
      {schedules.map((entry) => (
        <div key={entry.day} className={styles.row}>
          <span className={styles.dayLabel}>{WEEK_DAY_LABELS[entry.day]}</span>

          <div className={styles.times}>
            {entry.is24h ? (
              <span className={styles.allDay}>24h/24</span>
            ) : (
              <>
                <label className="visually-hidden" htmlFor={`${idPrefix}-${entry.day}-open`}>
                  Ouverture {WEEK_DAY_LABELS[entry.day]}
                </label>
                <input
                  id={`${idPrefix}-${entry.day}-open`}
                  type="time"
                  className={styles.timeInput}
                  value={entry.openTime}
                  onChange={(event) => updateDay(entry.day, { openTime: event.target.value })}
                />
                <span aria-hidden="true">→</span>
                <label className="visually-hidden" htmlFor={`${idPrefix}-${entry.day}-close`}>
                  Fermeture {WEEK_DAY_LABELS[entry.day]}
                </label>
                <input
                  id={`${idPrefix}-${entry.day}-close`}
                  type="time"
                  className={styles.timeInput}
                  value={entry.closeTime}
                  onChange={(event) => updateDay(entry.day, { closeTime: event.target.value })}
                />
              </>
            )}
          </div>

          <div className={styles.actions}>
            <label className={styles.toggle24h}>
              <input
                type="checkbox"
                checked={entry.is24h}
                onChange={(event) => updateDay(entry.day, { is24h: event.target.checked })}
              />
              24h/24
            </label>
            <button
              type="button"
              className={styles.copyBtn}
              onClick={() => onChange(copyDayScheduleToAll(entry, schedules))}
            >
              Copier sur tous
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
