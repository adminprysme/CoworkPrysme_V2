import { useEffect, useId, useRef, useState } from "react";
import type { PlanningSearchHit } from "@coworkprysme/shared";
import { IconSearch } from "@tabler/icons-react";

import { fetchPlanningSearch } from "../../../lib/planning-api.js";
import { PAYMENT_STATUS_LABELS } from "../planning-utils.js";
import styles from "./PlanningSearch.module.css";

interface PlanningSearchProps {
  onSelect: (hit: PlanningSearchHit) => void;
}

function formatHitDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function PlanningSearch({ onSelect }: PlanningSearchProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const suppressOpenRef = useRef(false);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlanningSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(input.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      setOpen(false);
      suppressOpenRef.current = false;
      return;
    }

    if (suppressOpenRef.current) {
      suppressOpenRef.current = false;
      setResults([]);
      setLoading(false);
      setError(null);
      setOpen(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchPlanningSearch(query)
      .then((payload) => {
        if (cancelled) return;
        setResults(payload.results);
        setOpen(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setResults([]);
        setError(err instanceof Error ? err.message : "Recherche impossible");
        setOpen(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div className={styles.root} ref={rootRef}>
      <label className={styles.field}>
        <IconSearch size={18} stroke={1.75} aria-hidden className={styles.icon} />
        <input
          type="search"
          value={input}
          placeholder="Rechercher client, société, espace, RES-…, PF-…"
          aria-label="Rechercher dans le planning"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          onFocus={() => {
            if (query.length >= 2 && results.length > 0) setOpen(true);
          }}
          onChange={(event) => {
            suppressOpenRef.current = false;
            setInput(event.target.value);
          }}
        />
      </label>

      {open && query.length >= 2 ? (
        <div className={styles.dropdown} id={listId} role="listbox">
          {loading ? <p className={styles.hint}>Recherche…</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
          {!loading && !error && results.length === 0 ? (
            <p className={styles.hint}>Aucun résultat</p>
          ) : null}
          {!loading && !error
            ? results.map((hit) => (
                <button
                  key={hit.reservationId}
                  type="button"
                  role="option"
                  className={styles.hit}
                  onClick={() => {
                    suppressOpenRef.current = true;
                    onSelect(hit);
                    setOpen(false);
                    setResults([]);
                    setInput(hit.reference);
                  }}
                >
                  <span className={styles.hitTop}>
                    <strong>{hit.reference}</strong>
                    <span className={styles.hitMeta}>{formatHitDate(hit.startAt)}</span>
                  </span>
                  <span className={styles.hitBottom}>
                    <span>{hit.clientLabel}</span>
                    <span aria-hidden>·</span>
                    <span>{hit.spaceName}</span>
                    <span aria-hidden>·</span>
                    <span>{PAYMENT_STATUS_LABELS[hit.paymentStatus]}</span>
                    {hit.invoiceReference ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{hit.invoiceReference}</span>
                      </>
                    ) : null}
                  </span>
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
