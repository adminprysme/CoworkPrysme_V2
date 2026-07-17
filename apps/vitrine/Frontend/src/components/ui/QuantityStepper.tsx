"use client";

import { useEffect, useState } from "react";

import styles from "./QuantityStepper.module.css";

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  fullWidth?: boolean;
  "aria-label"?: string;
  decreaseLabel?: string;
  increaseLabel?: string;
}

function clamp(value: number, min: number, max: number | undefined): number {
  let next = value;
  if (next < min) next = min;
  if (max !== undefined && next > max) next = max;
  return next;
}

export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max,
  size = "sm",
  fullWidth = false,
  "aria-label": ariaLabel,
  decreaseLabel = "Diminuer",
  increaseLabel = "Augmenter",
}: QuantityStepperProps) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;

  useEffect(() => {
    if (!focused) {
      setDraft(String(value));
    }
  }, [focused, value]);

  function commit(raw: string) {
    const parsed = Number.parseInt(raw.trim(), 10);
    if (!Number.isFinite(parsed)) {
      onChange(min);
      setDraft(String(min));
      return;
    }
    const next = clamp(parsed, min, max);
    onChange(next);
    setDraft(String(next));
  }

  return (
    <div
      className={[styles.stepper, size === "md" ? styles.md : "", fullWidth ? styles.fullWidth : ""]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className={styles.button}
        aria-label={decreaseLabel}
        disabled={atMin}
        onClick={() => {
          const next = clamp(value - 1, min, max);
          onChange(next);
          setDraft(String(next));
        }}
      >
        −
      </button>
      <input
        className={styles.value}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        aria-label={ariaLabel}
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          const next = event.target.value.replace(/[^\d]/g, "");
          setDraft(next);
          if (next === "") return;
          const parsed = Number.parseInt(next, 10);
          if (Number.isFinite(parsed)) {
            onChange(clamp(parsed, min, max));
          }
        }}
        onBlur={() => {
          setFocused(false);
          commit(draft);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            (event.target as HTMLInputElement).blur();
          }
        }}
      />
      <button
        type="button"
        className={styles.button}
        aria-label={increaseLabel}
        disabled={atMax}
        onClick={() => {
          const next = clamp(value + 1, min, max);
          onChange(next);
          setDraft(String(next));
        }}
      >
        +
      </button>
    </div>
  );
}
