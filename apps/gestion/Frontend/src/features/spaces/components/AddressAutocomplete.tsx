import { useEffect, useId, useRef, useState } from "react";

import type { BuildingAddress } from "../types.js";
import { formatAddressSummary } from "../utils/schedule.js";
import { searchAddresses, type GeocodedAddress } from "../utils/geocoding.js";
import styles from "./AddressAutocomplete.module.css";

interface AddressAutocompleteProps {
  idPrefix: string;
  address: BuildingAddress;
  onSelect: (payload: GeocodedAddress) => void;
}

export function AddressAutocomplete({ idPrefix, address, onSelect }: AddressAutocompleteProps) {
  const formattedAddress = formatAddressSummary(address);
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(formattedAddress);
  const [suggestions, setSuggestions] = useState<GeocodedAddress[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(formattedAddress);
  }, [formattedAddress]);

  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setLoading(true);
      setError(null);

      void searchAddresses(query, controller.signal)
        .then((results) => {
          setSuggestions(results);
          setOpen(results.length > 0);
          setActiveIndex(-1);
        })
        .catch((fetchError: unknown) => {
          if (controller.signal.aborted) {
            return;
          }
          setSuggestions([]);
          setOpen(false);
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Impossible de charger les suggestions.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function chooseSuggestion(suggestion: GeocodedAddress) {
    setQuery(suggestion.label);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    onSelect(suggestion);
  }

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <label className={styles.label} htmlFor={`${idPrefix}-address-search`}>
        Rechercher une adresse
      </label>
      <input
        id={`${idPrefix}-address-search`}
        className={styles.input}
        value={query}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${idPrefix}-address-option-${activeIndex}` : undefined
        }
        placeholder="Commencez à saisir une adresse…"
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
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
      <p className={styles.hint}>
        Sélectionnez une suggestion pour remplir l&apos;adresse et positionner le bâtiment sur la
        carte.
      </p>

      {loading ? <p className={styles.status}>Recherche en cours…</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      {open && suggestions.length > 0 ? (
        <ul id={listId} className={styles.list} role="listbox">
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.lat}-${suggestion.lng}-${index}`} role="presentation">
              <button
                id={`${idPrefix}-address-option-${index}`}
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
