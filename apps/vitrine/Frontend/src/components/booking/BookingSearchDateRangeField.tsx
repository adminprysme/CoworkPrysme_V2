"use client";

import { useEffect, useId, useRef, useState } from "react";

import { isSameDay } from "@/lib/booking-date-utils";

import { BookingSearchDateRangePicker } from "./BookingSearchDateRangePicker";
import styles from "./BookingSearchDateRangeField.module.css";

interface BookingSearchDateRangeFieldProps {
  startDate: Date | null;
  endDate: Date | null;
  onRangeChange: (start: Date | null, end: Date | null) => void;
  recurringReservationMailto: string;
  /** Optional extra class on the field root (e.g. home SearchBar layout). */
  className?: string;
  label?: string;
  id?: string;
}

function formatTriggerLabel(startDate: Date | null, endDate: Date | null): string {
  if (!startDate) {
    return "Choisir une plage de dates";
  }
  const startFmt = startDate.toLocaleDateString("fr-FR");
  if (!endDate) {
    return `Début : ${startFmt}`;
  }
  if (isSameDay(startDate, endDate)) {
    return startFmt;
  }
  return `Du ${startFmt} au ${endDate.toLocaleDateString("fr-FR")}`;
}

export function BookingSearchDateRangeField({
  startDate,
  endDate,
  onRangeChange,
  recurringReservationMailto,
  className,
  label = "Dates",
  id,
}: BookingSearchDateRangeFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const panelId = `${fieldId}-panel`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (target && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={[styles.field, className].filter(Boolean).join(" ")}>
      <span className={styles.label} id={`${fieldId}-label`}>
        {label}
      </span>
      <button
        type="button"
        id={fieldId}
        className={[styles.trigger, open ? styles.triggerOpen : ""].filter(Boolean).join(" ")}
        aria-labelledby={`${fieldId}-label`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={startDate ? styles.triggerValue : styles.triggerPlaceholder}>
          {formatTriggerLabel(startDate, endDate)}
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          className={styles.panel}
          role="dialog"
          aria-label="Sélection de la plage de dates"
        >
          <BookingSearchDateRangePicker
            startDate={startDate}
            endDate={endDate}
            recurringReservationMailto={recurringReservationMailto}
            onRangeChange={(start, end) => {
              onRangeChange(start, end);
              if (start && end) {
                setOpen(false);
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
