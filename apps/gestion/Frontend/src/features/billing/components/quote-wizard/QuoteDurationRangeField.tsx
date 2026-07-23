import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import pageStyles from "../../BillingPages.module.css";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  defaultTimesForQuoteMode,
  formatDayKey,
  formatMonthLabel,
  formatRangeTriggerLabel,
  isBeforeDay,
  isDayInRange,
  isPastDay,
  isSameDay,
  localRangeFromDates,
  parseLocalDatePart,
  parseLocalTimePart,
  resolveQuoteDateRangeMode,
  startOfDay,
  WEEKDAY_LABELS,
} from "./quote-duration-date-utils.js";
import styles from "./QuoteDurationRangeField.module.css";

type QuoteDurationRangeFieldProps = {
  startLocal: string;
  endLocal: string;
  onChange: (next: { startLocal: string; endLocal: string }) => void;
  label?: string;
  id?: string;
};

type PanelCoords = { top: number; left: number; width: number };

export function QuoteDurationRangeField({
  startLocal,
  endLocal,
  onChange,
  label = "Durée",
  id,
}: QuoteDurationRangeFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const panelId = `${fieldId}-panel`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<PanelCoords | null>(null);

  const startDate = useMemo(() => parseLocalDatePart(startLocal), [startLocal]);
  const endDate = useMemo(() => parseLocalDatePart(endLocal), [endLocal]);
  const startTime = useMemo(
    () =>
      startLocal ? parseLocalTimePart(startLocal) : defaultTimesForQuoteMode("same_day").startTime,
    [startLocal],
  );
  const endTime = useMemo(
    () => (endLocal ? parseLocalTimePart(endLocal) : defaultTimesForQuoteMode("same_day").endTime),
    [endLocal],
  );
  const mode = resolveQuoteDateRangeMode(startDate, endDate);

  const [visibleMonth, setVisibleMonth] = useState(() => startOfDay(new Date()));
  const [focusedDay, setFocusedDay] = useState<Date | null>(() => startOfDay(new Date()));
  const [draftStart, setDraftStart] = useState<Date | null>(startDate);
  const [draftEnd, setDraftEnd] = useState<Date | null>(endDate);

  const updateCoords = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelWidth = Math.min(Math.max(rect.width, 280), 320);
    const gap = 8;
    const viewportPad = 12;
    let left = rect.left;
    if (left + panelWidth > window.innerWidth - viewportPad) {
      left = Math.max(viewportPad, window.innerWidth - panelWidth - viewportPad);
    }
    const estimatedHeight = 360;
    const below = rect.bottom + gap;
    const above = rect.top - gap - estimatedHeight;
    const top =
      below + estimatedHeight <= window.innerHeight - viewportPad
        ? below
        : Math.max(viewportPad, above);
    setCoords({ top, left, width: panelWidth });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updateCoords();
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) {
      setDraftStart(startDate);
      setDraftEnd(endDate);
      if (startDate) {
        setVisibleMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
        setFocusedDay(startDate);
      }
    }
  }, [endDate, open, startDate]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function handleReposition() {
      updateCoords();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    // Reposition when the wizard modal body scrolls
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, updateCoords]);

  const rangeSummary = useMemo(() => {
    if (!draftStart) return "Sélectionnez une date de début.";
    if (!draftEnd) {
      return `Début : ${draftStart.toLocaleDateString("fr-FR")} — choisissez la date de fin.`;
    }
    if (isSameDay(draftStart, draftEnd)) {
      return `Date sélectionnée : ${draftStart.toLocaleDateString("fr-FR")}.`;
    }
    return `Du ${draftStart.toLocaleDateString("fr-FR")} au ${draftEnd.toLocaleDateString("fr-FR")}.`;
  }, [draftEnd, draftStart]);

  const commitRange = useCallback(
    (start: Date, end: Date, nextStartTime = startTime, nextEndTime = endTime) => {
      const nextMode = resolveQuoteDateRangeMode(start, end);
      const defaults = defaultTimesForQuoteMode(nextMode);
      const times =
        startLocal && endLocal && resolveQuoteDateRangeMode(startDate, endDate) === nextMode
          ? { startTime: nextStartTime, endTime: nextEndTime }
          : defaults;
      onChange(localRangeFromDates(start, end, times.startTime, times.endTime));
    },
    [endLocal, endTime, onChange, startDate, startLocal, startTime, endDate],
  );

  const handleDayClick = useCallback(
    (day: Date) => {
      if (isPastDay(day)) return;

      if (!draftStart || (draftStart && draftEnd)) {
        setDraftStart(day);
        setDraftEnd(null);
        return;
      }

      const start = isBeforeDay(day, draftStart) ? day : draftStart;
      const end = isBeforeDay(day, draftStart) ? draftStart : day;
      setDraftStart(start);
      setDraftEnd(end);
      commitRange(start, end);
      setOpen(false);
    },
    [commitRange, draftEnd, draftStart],
  );

  const cells = useMemo(
    () => buildMonthGrid(visibleMonth.getFullYear(), visibleMonth.getMonth()),
    [visibleMonth],
  );

  const today = useMemo(() => startOfDay(new Date()), []);

  function patchTime(which: "start" | "end", value: string) {
    if (!startDate || !endDate) return;
    const nextStart = which === "start" ? value : startTime;
    const nextEnd = which === "end" ? value : endTime;
    commitRange(startDate, endDate, nextStart, nextEnd);
  }

  const calendarPanel =
    open && coords
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            className={styles.panelPortal}
            role="dialog"
            aria-label="Sélection de la plage de dates"
            style={{ top: coords.top, left: coords.left, width: coords.width }}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.calendar}>
              <div className={styles.calendarTopBar}>
                <p className={styles.rangeSummary} aria-live="polite">
                  {rangeSummary}
                </p>
                <button
                  type="button"
                  className={styles.todayButton}
                  onClick={() => {
                    const todayDate = startOfDay(new Date());
                    setVisibleMonth(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
                    setFocusedDay(todayDate);
                  }}
                >
                  Aujourd&apos;hui
                </button>
              </div>

              <div className={styles.calendarHeader}>
                <button
                  type="button"
                  className={styles.navButton}
                  aria-label="Mois précédent"
                  onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
                >
                  ←
                </button>
                <h3 className={styles.monthTitle}>{formatMonthLabel(visibleMonth)}</h3>
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
                role="grid"
                aria-label="Calendrier durée devis"
                onKeyDown={(event) => {
                  if (!focusedDay) return;
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
                  if (!nextDay || isPastDay(nextDay)) return;
                  setFocusedDay(nextDay);
                  if (
                    nextDay.getMonth() !== visibleMonth.getMonth() ||
                    nextDay.getFullYear() !== visibleMonth.getFullYear()
                  ) {
                    setVisibleMonth(new Date(nextDay.getFullYear(), nextDay.getMonth(), 1));
                  }
                }}
              >
                <div className={styles.weekdayRow} aria-hidden="true">
                  {WEEKDAY_LABELS.map((weekday) => (
                    <span key={weekday} className={styles.weekday}>
                      {weekday}
                    </span>
                  ))}
                </div>
                <div className={styles.daysGrid} role="rowgroup">
                  {cells.map((day, index) => {
                    if (!day) {
                      return (
                        <div
                          key={`empty-${index}`}
                          className={styles.dayCellEmpty}
                          role="presentation"
                        />
                      );
                    }

                    const past = isPastDay(day, today);
                    const selectedStart = draftStart ? isSameDay(day, draftStart) : false;
                    const selectedEnd = draftEnd ? isSameDay(day, draftEnd) : false;
                    const inRange = isDayInRange(day, draftStart, draftEnd);
                    const isRangeStart =
                      selectedStart &&
                      draftEnd !== null &&
                      draftStart !== null &&
                      !isSameDay(draftStart, draftEnd);
                    const isRangeEnd =
                      selectedEnd &&
                      draftStart !== null &&
                      draftEnd !== null &&
                      !isSameDay(draftStart, draftEnd);
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

                    return (
                      <div key={formatDayKey(day)} className={dayClassName} role="presentation">
                        <button
                          type="button"
                          role="gridcell"
                          className={buttonClassName}
                          disabled={past}
                          tabIndex={focusedDay && isSameDay(day, focusedDay) ? 0 : -1}
                          aria-selected={selectedStart || selectedEnd || inRange}
                          onClick={() => handleDayClick(day)}
                          onFocus={() => setFocusedDay(day)}
                        >
                          {day.getDate()}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={styles.field}>
      <span className={styles.label} id={`${fieldId}-label`}>
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        id={fieldId}
        className={[styles.trigger, open ? styles.triggerOpen : ""].filter(Boolean).join(" ")}
        aria-label={`${label} : ${formatRangeTriggerLabel(startDate, endDate)}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <span className={startDate ? styles.triggerValue : styles.triggerPlaceholder}>
          {formatRangeTriggerLabel(startDate, endDate)}
        </span>
      </button>

      {calendarPanel}

      {mode === "same_day" || mode === "short_stay" ? (
        <div className={styles.timeRow} onClick={(event) => event.stopPropagation()}>
          <label className={pageStyles.label}>
            {mode === "same_day" ? "Heure début" : "Arrivée"}
            <input
              className={pageStyles.input}
              type="time"
              value={startTime}
              onChange={(event) => patchTime("start", event.target.value)}
            />
          </label>
          <label className={pageStyles.label}>
            {mode === "same_day" ? "Heure fin" : "Départ"}
            <input
              className={pageStyles.input}
              type="time"
              value={endTime}
              onChange={(event) => patchTime("end", event.target.value)}
            />
          </label>
        </div>
      ) : null}

      {mode === "monthly" ? (
        <p className={pageStyles.muted} style={{ margin: 0, fontSize: "0.8rem" }}>
          Accès selon les horaires de l&apos;espace sur toute la durée.
        </p>
      ) : null}
    </div>
  );
}
