"use client";

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
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;

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
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className={styles.value} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={styles.button}
        aria-label={increaseLabel}
        disabled={atMax}
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
      >
        +
      </button>
    </div>
  );
}
