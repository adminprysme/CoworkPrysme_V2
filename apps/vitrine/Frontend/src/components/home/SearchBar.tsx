"use client";

import type { SpaceType } from "@coworkprysme/shared";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { BookingSearchDateRangeField } from "@/components/booking/BookingSearchDateRangeField";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { buildRecurringReservationMailto } from "@/lib/booking-recurring-contact";
import { buildHomeBookingSearchHref } from "@/lib/booking-home-search";
import { SITE } from "@/config/site";

import styles from "./SearchBar.module.css";

const SPACE_TYPE_OPTIONS = [
  { value: "meeting_room" as const, label: "Salle de réunion" },
  { value: "private_office" as const, label: "Bureau privatif" },
];

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
              <SegmentedToggle
                fullWidth
                size="md"
                aria-labelledby="search-type-label"
                value={spaceType}
                onChange={(next) => {
                  setSpaceType(next);
                  setError(null);
                }}
                options={SPACE_TYPE_OPTIONS}
              />
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

            <div className={styles.field}>
              <span className={styles.label} id="search-party-size-label">
                Nombre de personnes
              </span>
              <QuantityStepper
                fullWidth
                size="md"
                min={1}
                max={50}
                value={partySize}
                onChange={(next) => {
                  setPartySize(next);
                  setError(null);
                }}
                aria-label="Nombre de personnes"
                decreaseLabel="Diminuer le nombre de personnes"
                increaseLabel="Augmenter le nombre de personnes"
              />
            </div>

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
