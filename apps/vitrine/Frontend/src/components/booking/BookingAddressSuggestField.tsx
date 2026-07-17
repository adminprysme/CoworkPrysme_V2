"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  BAN_DEBOUNCE_MS,
  BAN_MIN_QUERY_LENGTH,
  fetchBanAddressSuggestions,
  type BanAddressSuggestion,
} from "@/lib/ban-address";

import accountStyles from "./BookingAccountStep.module.css";
import styles from "./BookingAddressSuggestField.module.css";

type BookingAddressSuggestFieldProps = {
  street: string;
  zip: string;
  city: string;
  onStreetChange: (street: string) => void;
  onSelect: (suggestion: BanAddressSuggestion) => void;
};

export function BookingAddressSuggestField({
  street,
  zip,
  city,
  onStreetChange,
  onSelect,
}: BookingAddressSuggestFieldProps) {
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<BanAddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (street.trim().length < BAN_MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setLoading(true);
      void fetchBanAddressSuggestions(street, controller.signal)
        .then((results) => {
          if (controller.signal.aborted) {
            return;
          }
          setSuggestions(results);
          setOpen(results.length > 0);
          setActiveIndex(-1);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, BAN_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [street]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function chooseSuggestion(suggestion: BanAddressSuggestion) {
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    onSelect(suggestion);
  }

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <label className={accountStyles.field}>
        <span className={accountStyles.fieldLabel}>Adresse</span>
        <input
          className={accountStyles.input}
          type="text"
          autoComplete="street-address"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
          value={street}
          onChange={(event) => onStreetChange(event.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) {
              setOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (!open || suggestions.length === 0) {
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) => (current + 1) % suggestions.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
            } else if (event.key === "Enter" && activeIndex >= 0) {
              event.preventDefault();
              chooseSuggestion(suggestions[activeIndex]!);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </label>
      <p className={styles.hint}>
        Saisissez quelques caractères pour proposer une adresse (BAN).
        {zip || city ? ` · ${[zip, city].filter(Boolean).join(" ")}` : ""}
      </p>
      {loading ? <p className={styles.status}>Recherche d&apos;adresse…</p> : null}

      {open && suggestions.length > 0 ? (
        <ul id={listId} className={styles.list} role="listbox">
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.label}-${index}`} role="presentation">
              <button
                id={`${listId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={[styles.option, index === activeIndex ? styles.optionActive : ""]
                  .filter(Boolean)
                  .join(" ")}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => chooseSuggestion(suggestion)}
              >
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
