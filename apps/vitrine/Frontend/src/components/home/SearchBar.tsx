"use client";

import type { SpaceType } from "@coworkprysme/shared";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { BookingSearchDateRangeField } from "@/components/booking/BookingSearchDateRangeField";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { buildRecurringReservationMailto } from "@/lib/booking-recurring-contact";
import { buildHomeBookingSearchHref } from "@/lib/booking-home-search";
import { SITE } from "@/config/site";

import styles from "./SearchBar.module.css";

export function SearchBar() {
  const router = useRouter();
  const [spaceType, setSpaceType] = useState<SpaceType>("meeting_room");
  const [partySize, setPartySize] = useState(4);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recurringReservationMailto = useMemo(
    () =>
      buildRecurringReservationMailto(SITE.contact.email, {
        spaceType,
        partySize,
      }),
    [partySize, spaceType],
  );

  return (
    <div className={styles.wrapper} id="recherche">
      <Container>
        <div className={styles.card}>
          <h2 className={styles.title}>Rechercher un espace</h2>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              if (!startDate || !endDate) {
                setError("Sélectionnez une plage de dates (début et fin).");
                return;
              }
              if (partySize < 1 || partySize > 50) {
                setError("Indiquez un nombre de personnes entre 1 et 50.");
                return;
              }
              setError(null);
              router.push(
                buildHomeBookingSearchHref({
                  spaceType,
                  partySize,
                  startDate,
                  endDate,
                }),
              );
            }}
            aria-label="Recherche d'espace"
          >
            <div className={styles.field}>
              <span className={styles.label} id="search-type-label">
                Type d&apos;espace
              </span>
              <div className={styles.typeToggle} role="group" aria-labelledby="search-type-label">
                <button
                  type="button"
                  className={[
                    styles.typeOption,
                    spaceType === "meeting_room" ? styles.typeOptionActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSpaceType("meeting_room")}
                >
                  Salle de réunion
                </button>
                <button
                  type="button"
                  className={[
                    styles.typeOption,
                    spaceType === "private_office" ? styles.typeOptionActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSpaceType("private_office")}
                >
                  Bureau
                </button>
              </div>
            </div>

            <BookingSearchDateRangeField
              className={styles.dateField}
              startDate={startDate}
              endDate={endDate}
              recurringReservationMailto={recurringReservationMailto}
              onRangeChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
                setError(null);
              }}
            />

            <label className={styles.field}>
              <span className={styles.label}>Nombre de personnes</span>
              <input
                className={styles.input}
                type="number"
                min={1}
                max={50}
                value={partySize}
                inputMode="numeric"
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value, 10);
                  setPartySize(Number.isFinite(next) ? next : 1);
                  setError(null);
                }}
              />
            </label>

            <div className={[styles.field, styles.submitField].join(" ")}>
              <span className={styles.label} aria-hidden="true">
                Action
              </span>
              <Button type="submit" variant="primary" fullWidth size="lg">
                Rechercher
              </Button>
            </div>
          </form>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Container>
    </div>
  );
}
