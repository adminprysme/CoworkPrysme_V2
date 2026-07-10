"use client";

import type { BookingLockResponse, BookingSpaceCard, SpaceType } from "@coworkprysme/shared";
import { formatCentsAsEuroString } from "@coworkprysme/shared";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { Container } from "@/components/ui/Container";
import {
  combineDateAndTime,
  defaultSearchEndTime,
  defaultSearchStartTime,
  flexibleDurationClassHint,
  formatAvailabilityWindow,
  formatMonthHeading,
  monthRange,
  type BookingFlexibleDuration,
  type BookingSearchMode,
  type CalendarDurationFilter,
} from "@/lib/booking-date-utils";
import { formatCountdown, useBookingLockCountdown } from "@/hooks/useBookingLock";
import { getBookingSessionId } from "@/lib/booking-session";
import {
  createBookingLock,
  fetchBookingAvailability,
  fetchBookingSpaces,
  fetchSpaceAvailability,
  releaseBookingLock,
} from "@/lib/get-booking-api";

import { BookingFlexibleSearchPanel } from "./BookingFlexibleSearchPanel";
import { BookingSearchDateRangePicker } from "./BookingSearchDateRangePicker";
import { BookingProgressBar } from "./BookingProgressBar";
import styles from "./booking.module.css";

type BookingView = "search" | "results" | "calendar" | "locked";

type CalendarSlot = {
  startAt: string;
  endAt: string;
  durationClass: string;
  selectable: boolean;
};

function formatSlotLabel(startAt: string, endAt: string): string {
  return formatAvailabilityWindow(startAt, endAt);
}

function buildSearchWindow(
  startDate: Date,
  endDate: Date,
  startTime: string,
  endTime: string,
): { startAt: string; endAt: string } {
  const startAt = combineDateAndTime(startDate, startTime);
  const endAt = combineDateAndTime(endDate, endTime);
  return {
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
  };
}

export function BookingPageContent() {
  const [view, setView] = useState<BookingView>("search");
  const [searchMode, setSearchMode] = useState<BookingSearchMode>("dates");
  const [spaceType, setSpaceType] = useState<SpaceType>("meeting_room");
  const [partySize, setPartySize] = useState(4);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState(defaultSearchStartTime);
  const [endTime, setEndTime] = useState(() => defaultSearchEndTime(defaultSearchStartTime()));
  const [flexDuration, setFlexDuration] = useState<BookingFlexibleDuration | null>(null);
  const [flexMonth, setFlexMonth] = useState<Date | null>(null);
  const [spaces, setSpaces] = useState<BookingSpaceCard[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<BookingSpaceCard | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date | null>(null);
  const [calendarDurationFilter, setCalendarDurationFilter] =
    useState<CalendarDurationFilter>("all");
  const [calendarSlots, setCalendarSlots] = useState<CalendarSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<{ startAt: string; endAt: string } | null>(null);
  const [lock, setLock] = useState<BookingLockResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockExpiredMessage, setLockExpiredMessage] = useState<string | null>(null);

  const remainingMs = useBookingLockCountdown(lock?.expiresAt ?? null);

  const selectedRangeLabel = useMemo(() => {
    if (!selectedSlot) {
      return null;
    }
    return formatSlotLabel(selectedSlot.startAt, selectedSlot.endAt);
  }, [selectedSlot]);

  const visibleCalendarSlots = useMemo(() => {
    const filtered =
      calendarDurationFilter === "all"
        ? calendarSlots
        : calendarSlots.filter((slot) => slot.durationClass === calendarDurationFilter);

    return [...filtered].sort((left, right) => {
      if (calendarDurationFilter !== "all") {
        return new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
      }
      const leftPreferred = left.durationClass === "daily" ? 0 : 1;
      const rightPreferred = right.durationClass === "daily" ? 0 : 1;
      if (leftPreferred !== rightPreferred) {
        return leftPreferred - rightPreferred;
      }
      return new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
    });
  }, [calendarDurationFilter, calendarSlots]);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    setLockExpiredMessage(null);
    setLock(null);
    setSelectedSpace(null);
    setSelectedSlot(null);
    setCalendarSlots([]);
    setCalendarMonth(null);

    try {
      if (searchMode === "flexible") {
        if (!flexDuration) {
          setError("Choisissez une durée de réservation.");
          setView("search");
          return;
        }
        if (!flexMonth) {
          setError("Choisissez un mois de réservation.");
          setView("search");
          return;
        }

        const result = await fetchBookingSpaces({ spaceType, partySize });
        setSpaces(result);
        setView("results");
        return;
      }

      if (!startDate || !endDate) {
        setError("Sélectionnez une plage de dates dans le calendrier.");
        setView("search");
        return;
      }

      const window = buildSearchWindow(startDate, endDate, startTime, endTime);
      if (new Date(window.endAt) <= new Date(window.startAt)) {
        setError("L'heure de fin doit être postérieure à l'heure de début.");
        setView("search");
        return;
      }

      const result = await fetchBookingAvailability({
        spaceType,
        partySize,
        startAt: window.startAt,
        endAt: window.endAt,
      });
      setSpaces(result);
      setView("results");
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Recherche impossible");
      setView("search");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectSpace(space: BookingSpaceCard) {
    setError(null);
    setSelectedSpace(space);
    setSelectedSlot(null);
    setLock(null);

    if (searchMode === "flexible") {
      if (!flexMonth || !flexDuration) {
        setError("Sélectionnez une durée et un mois avant de choisir un espace.");
        return;
      }

      setLoading(true);
      try {
        setCalendarMonth(flexMonth);
        setCalendarDurationFilter(flexibleDurationClassHint(flexDuration));
        const range = monthRange(flexMonth);
        const availability = await fetchSpaceAvailability(space.spaceId, range);
        setCalendarSlots(availability.slots);
        setView("calendar");
      } catch (calendarError) {
        setError(
          calendarError instanceof Error ? calendarError.message : "Calendrier indisponible",
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!startDate || !endDate) {
      setError("Sélectionnez une plage de dates dans le calendrier.");
      return;
    }

    const window = buildSearchWindow(startDate, endDate, startTime, endTime);
    await handleCreateLock(space, window.startAt, window.endAt);
  }

  async function handleCreateLock(space: BookingSpaceCard, slotStartAt: string, slotEndAt: string) {
    setLoading(true);
    setError(null);
    setLockExpiredMessage(null);

    try {
      const sessionId = getBookingSessionId();
      const response = await createBookingLock({
        spaceId: space.spaceId,
        startAt: slotStartAt,
        endAt: slotEndAt,
        sessionId,
        partySize,
      });
      setLock(response);
      setSelectedSlot({ startAt: slotStartAt, endAt: slotEndAt });
      setView("locked");
    } catch (lockError) {
      setError(
        lockError instanceof Error
          ? lockError.message
          : "Ce créneau vient d'être pris par quelqu'un d'autre",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleReleaseLock() {
    if (!lock) {
      return;
    }
    const sessionId = getBookingSessionId();
    await releaseBookingLock(lock.lockId, sessionId);
    setLock(null);
    setView(searchMode === "flexible" ? "calendar" : "results");
  }

  useEffect(() => {
    if (remainingMs !== 0 || !lock) {
      return;
    }

    const sessionId = getBookingSessionId();
    void releaseBookingLock(lock.lockId, sessionId);
    setLock(null);
    setLockExpiredMessage("Votre réservation temporaire a expiré. Relancez une recherche.");
    setView("search");
  }, [remainingMs, lock]);

  return (
    <section className={styles.bookingSection}>
      <Container>
        <div className={styles.header}>
          <h1 className={styles.title}>Réserver un espace</h1>
          <p className={styles.lead}>
            Choisissez vos dates puis recherchez un espace disponible (Parcours A), ou indiquez une
            durée et un mois pour parcourir le catalogue puis choisir un créneau (Parcours B).
          </p>
        </div>

        <BookingProgressBar />

        {(view === "search" || view === "results" || view === "calendar") && (
          <form
            className={styles.searchForm}
            onSubmit={(event) => {
              event.preventDefault();
              void handleSearch();
            }}
          >
            <div className={styles.searchGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Type d&apos;espace</span>
                <select
                  className={styles.fieldSelect}
                  value={spaceType}
                  onChange={(event) => setSpaceType(event.target.value as SpaceType)}
                >
                  <option value="meeting_room">Salle de réunion</option>
                  <option value="private_office">Bureau privatif</option>
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Nombre de personnes</span>
                <input
                  className={styles.fieldInput}
                  type="number"
                  min={1}
                  value={partySize}
                  onChange={(event) => setPartySize(Number(event.target.value))}
                />
              </label>
            </div>

            <div className={styles.dateSection}>
              <span className={styles.fieldLabel}>Dates et horaires</span>

              <div
                className={styles.searchModeToggle}
                role="tablist"
                aria-label="Mode de recherche"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={searchMode === "dates"}
                  className={[
                    styles.searchModeToggleButton,
                    searchMode === "dates" ? styles.searchModeToggleButtonActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSearchMode("dates")}
                >
                  Dates
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={searchMode === "flexible"}
                  className={[
                    styles.searchModeToggleButton,
                    searchMode === "flexible" ? styles.searchModeToggleButtonActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSearchMode("flexible")}
                >
                  Flexible
                </button>
              </div>

              {searchMode === "dates" ? (
                <>
                  <BookingSearchDateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onRangeChange={(start, end) => {
                      setStartDate(start);
                      setEndDate(end);
                    }}
                  />

                  <div className={styles.timeRow}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Heure de début</span>
                      <input
                        className={styles.fieldInput}
                        type="time"
                        value={startTime}
                        onChange={(event) => {
                          setStartTime(event.target.value);
                          setEndTime(defaultSearchEndTime(event.target.value));
                        }}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Heure de fin</span>
                      <input
                        className={styles.fieldInput}
                        type="time"
                        value={endTime}
                        onChange={(event) => setEndTime(event.target.value)}
                      />
                    </label>
                  </div>
                </>
              ) : (
                <BookingFlexibleSearchPanel
                  duration={flexDuration}
                  onDurationChange={setFlexDuration}
                  selectedMonth={flexMonth}
                  onMonthChange={setFlexMonth}
                />
              )}
            </div>

            <div className={styles.searchActions}>
              <button className={styles.primaryButton} type="submit" disabled={loading}>
                {loading
                  ? "Recherche…"
                  : searchMode === "flexible"
                    ? "Voir les espaces"
                    : "Rechercher"}
              </button>
              {view !== "search" ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    setView("search");
                    setSpaces([]);
                    setSelectedSpace(null);
                    setCalendarSlots([]);
                  }}
                >
                  Nouvelle recherche
                </button>
              ) : null}
            </div>

            {error ? <p className={`${styles.message} ${styles.messageError}`}>{error}</p> : null}
            {lockExpiredMessage ? (
              <p className={`${styles.message} ${styles.messageInfo}`}>{lockExpiredMessage}</p>
            ) : null}
          </form>
        )}

        {(view === "results" || view === "calendar") && spaces.length > 0 ? (
          <>
            <div className={styles.resultsHeader}>
              <h2 className={styles.resultsTitle}>
                {searchMode === "flexible" ? "Espaces disponibles" : "Espaces disponibles"}
              </h2>
              <span>
                {spaces.length} espace{spaces.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className={styles.spaceGrid}>
              {spaces.map((space) => (
                <article
                  key={space.spaceId}
                  className={[
                    styles.spaceCard,
                    selectedSpace?.spaceId === space.spaceId ? styles.spaceCardSelected : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className={styles.spaceCardTop}>
                    <div className={styles.spaceImageWrap}>
                      {space.primaryPhotoUrl ? (
                        <Image
                          src={space.primaryPhotoUrl}
                          alt={space.name}
                          fill
                          sizes="7rem"
                          className={styles.spaceImage}
                        />
                      ) : (
                        <div className={styles.spaceImagePlaceholder}>Photo</div>
                      )}
                    </div>

                    <div>
                      <h3 className={styles.spaceName}>{space.name}</h3>
                      <p className={styles.spaceMeta}>
                        {space.buildingName} · {space.city} · {space.capacity} pers.
                      </p>
                      <ul className={styles.equipments}>
                        {space.equipments.map((equipment) => (
                          <li key={equipment} className={styles.equipmentTag}>
                            {equipment}
                          </li>
                        ))}
                      </ul>
                      {space.priceFromHTCents !== null ? (
                        <p className={styles.priceFrom}>
                          À partir de {formatCentsAsEuroString(space.priceFromHTCents)} € HT
                          {space.priceFromLabel ? ` / ${space.priceFromLabel.toLowerCase()}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={loading}
                    onClick={() => void handleSelectSpace(space)}
                  >
                    {searchMode === "flexible" ? "Voir les créneaux" : "Réserver ce créneau"}
                  </button>
                </article>
              ))}
            </div>
          </>
        ) : null}

        {view === "calendar" && selectedSpace && calendarMonth ? (
          <div className={styles.calendarPanel}>
            <h3 className={styles.calendarTitle}>
              Créneaux — {selectedSpace.name} · {formatMonthHeading(calendarMonth)}
            </h3>

            <div className={styles.calendarFilters} role="group" aria-label="Type de créneau">
              {(
                [
                  { value: "all", label: "Tous" },
                  { value: "hourly", label: "Horaire" },
                  { value: "daily", label: "Journée" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={[
                    styles.calendarFilterPill,
                    calendarDurationFilter === option.value ? styles.calendarFilterPillActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={calendarDurationFilter === option.value}
                  onClick={() => setCalendarDurationFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className={styles.slotGrid}>
              {visibleCalendarSlots.map((slot) => {
                const selected =
                  selectedSlot?.startAt === slot.startAt && selectedSlot.endAt === slot.endAt;
                const emphasized = slot.durationClass === "daily";
                return (
                  <button
                    key={`${slot.startAt}-${slot.endAt}`}
                    type="button"
                    disabled={!slot.selectable || loading}
                    className={[
                      styles.slotButton,
                      !slot.selectable ? styles.slotButtonDisabled : "",
                      selected ? styles.slotButtonSelected : "",
                      emphasized ? styles.slotButtonEmphasized : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => void handleCreateLock(selectedSpace, slot.startAt, slot.endAt)}
                  >
                    <span className={styles.slotDuration}>{slot.durationClass}</span>
                    <span className={styles.slotWhen}>
                      {formatSlotLabel(slot.startAt, slot.endAt)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {view === "locked" && lock && selectedSpace ? (
          <div className={styles.lockPanel}>
            <h2 className={styles.lockTitle}>Créneau réservé temporairement</h2>
            <p className={styles.lockCountdown}>{formatCountdown(remainingMs)}</p>
            <p className={styles.lockDetails}>
              {selectedSpace.name} — {selectedRangeLabel}
              <br />
              Finalisez votre réservation avant expiration du verrou (10 minutes).
            </p>
            <div className={styles.searchActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => void handleReleaseLock()}
              >
                Libérer le créneau
              </button>
            </div>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
