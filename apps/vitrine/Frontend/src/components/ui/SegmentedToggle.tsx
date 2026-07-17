"use client";

import styles from "./SegmentedToggle.module.css";

export type SegmentedToggleOption<T extends string> = {
  value: T;
  label: string;
};

interface SegmentedToggleProps<T extends string> {
  options: readonly SegmentedToggleOption<T>[];
  value: T;
  onChange: (next: T) => void;
  size?: "sm" | "md";
  fullWidth?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  role?: "group" | "tablist";
}

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
  fullWidth = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  role = "group",
}: SegmentedToggleProps<T>) {
  const useTabs = role === "tablist";

  return (
    <div
      className={[styles.toggle, size === "md" ? styles.md : "", fullWidth ? styles.fullWidth : ""]
        .filter(Boolean)
        .join(" ")}
      role={role}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role={useTabs ? "tab" : undefined}
            aria-selected={useTabs ? active : undefined}
            aria-pressed={!useTabs ? active : undefined}
            className={[styles.option, active ? styles.optionActive : ""].filter(Boolean).join(" ")}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
