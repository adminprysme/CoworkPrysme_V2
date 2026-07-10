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
  formatAvailabilityWindow,
} from "@/lib/booking-date-utils";
import { formatCountdown, useBookingLockCountdown } from "@/hooks/useBookingLock";
import { getBookingSessionId } from "@/lib/booking-session";
import {
  createBookingLock,
  fetchBookingAvailability,
  fetchBookingSpaces,
  fetchSpaceAvailability,
  monthRange,
  releaseBookingLock,
  type BookingAvailabilityResultSpace,
  type BookingFlexibilityDays,
} from "@/lib/get-booking-api";

import {
  BookingSearchDateRangePicker,
  type BookingDatePickerMode,
} from "./BookingSearchDateRangePicker";
import { BookingProgressBar } from "./BookingProgressBar";
import styles from "./booking.module.css";

type BookingView = "search" | "results" | "calendar" | "locked";

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
  const [catalogFirstMode, setCatalogFirstMode] = useState(false);
  const [spaceType, setSpaceType] = useState<SpaceType>("meeting_room");
  const [partySize, setPartySize] = useState(4);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState(defaultSearchStartTime);
  const [endTime, setEndTime] = useState(() => defaultSearchEndTime(defaultSearchStartTime()));
  const [dateMode, setDateMode] = useState<BookingDatePickerMode>("exact");
  const [flexibilityDays, setFlexibilityDays] = useState<BookingFlexibilityDays | null>(null);
  const [spaces, setSpaces] = useState<BookingAvailabilityResultSpace[]>([]);
  const [selectedWindowBySpace, setSelectedWindowBySpace] = useState<
    Record<string, { startAt: string; endAt: string }>
  >({});
  const [selectedSpace, setSelectedSpace] = useState<BookingSpaceCard | null>(null);
  const [calendarSlots, setCalendarSlots] = useState<
    Array<{ startAt: string; endAt: string; durationClass: string; selectable: boolean }>
  >([]);
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

  function handleRangeChange(start: Date | null, end: Date | null) {
    setStartDate(start);
    setEndDate(end);
  }

  async function handleSearch() {
    setLoading(true);
    setError(null);
    setLockExpiredMessage(null);
    setLock(null);
    setSelectedSpace(null);
    setSelectedSlot(null);
    setCalendarSlots([]);
    setSelectedWindowBySpace({});

    try {
      if (catalogFirstMode) {
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

      if (dateMode === "flexible" && !flexibilityDays) {
        setError("Choisissez une tolérance (± N jours) pour une recherche flexible.");
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
        flexibilityDays: dateMode === "flexible" ? (flexibilityDays ?? undefined) : undefined,
      });

      const initialWindows: Record<string, { startAt: string; endAt: string }> = {};
      for (const space of result) {
        if (space.availableWindows?.length) {
          initialWindows[space.spaceId] = space.availableWindows[0]!;
        }
      }
      setSelectedWindowBySpace(initialWindows);
      setSpaces(result);
      setView("results");
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Recherche impossible");
      setView("search");
    } finally {
      setLoading(false);
    }
  }

  function resolveBookingWindow(space: BookingAvailabilityResultSpace): {
    startAt: string;
    endAt: string;
  } | null {
    if (space.availableWindows?.length) {
      return selectedWindowBySpace[space.spaceId] ?? space.availableWindows[0] ?? null;
    }

    if (!startDate || !endDate) {
      return null;
    }

    return buildSearchWindow(startDate, endDate, startTime, endTime);
  }

  async function handleSelectSpace(space: BookingAvailabilityResultSpace) {
    setError(null);
    setSelectedSpace(space);
    setSelectedSlot(null);
    setLock(null);

    if (catalogFirstMode) {
      setLoading(true);
      try {
        const range = monthRange(new Date());
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

    const window = resolveBookingWindow(space);
    if (!window) {
      setError("Sélectionnez une date de disponibilité pour cet espace.");
      return;
    }

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
    setView(catalogFirstMode ? "calendar" : "results");
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

  const usingFlexibleSearch =
    !catalogFirstMode && dateMode === "flexible" && flexibilityDays !== null;

  return (
    <section className={styles.bookingSection}>
      <Container>
        <div className={styles.header}>
          <h1 className={styles.title}>Réserver un espace</h1>
          <p className={styles.lead}>
            Choisissez vos dates puis recherchez un espace disponible (Parcours A), ou parcourez
            d&apos;abord le catalogue pour choisir un espace puis un créneau (Parcours B).
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
              <div className={styles.dateSectionHeader}>
                <span className={styles.fieldLabel}>Dates et horaires</span>
                <button
                  type="button"
                  className={[
                    styles.catalogFirstToggle,
                    catalogFirstMode ? styles.catalogFirstToggleActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={catalogFirstMode}
                  onClick={() => setCatalogFirstMode((value) => !value)}
                >
                  Voir tous les espaces
                </button>
              </div>

              {!catalogFirstMode ? (
                <>
                  <BookingSearchDateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onRangeChange={handleRangeChange}
                    dateMode={dateMode}
                    onDateModeChange={setDateMode}
                    flexibilityDays={flexibilityDays}
                    onFlexibilityDaysChange={setFlexibilityDays}
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
                <p className={styles.catalogFirstHint}>
                  Parcours B : explorez le catalogue sans filtrer par dates, puis choisissez un
                  créneau dans le calendrier de l&apos;espace.
                </p>
              )}
            </div>

            <div className={styles.searchActions}>
              <button className={styles.primaryButton} type="submit" disabled={loading}>
                {loading ? "Recherche…" : catalogFirstMode ? "Explorer le catalogue" : "Rechercher"}
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
                {catalogFirstMode
                  ? "Espaces du catalogue"
                  : usingFlexibleSearch
                    ? `Espaces disponibles (± ${flexibilityDays} j.)`
                    : "Espaces disponibles"}
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

                  {space.availableWindows?.length ? (
                    <div className={styles.availableWindows}>
                      <p className={styles.availableWindowsLabel}>Dates disponibles</p>
                      <div className={styles.availableWindowsPills} role="list">
                        {space.availableWindows.map((window) => {
                          const selected =
                            selectedWindowBySpace[space.spaceId]?.startAt === window.startAt &&
                            selectedWindowBySpace[space.spaceId]?.endAt === window.endAt;
                          return (
                            <button
                              key={`${window.startAt}-${window.endAt}`}
                              type="button"
                              role="listitem"
                              className={[
                                styles.availableWindowPill,
                                selected ? styles.availableWindowPillActive : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              aria-pressed={selected}
                              onClick={() =>
                                setSelectedWindowBySpace((current) => ({
                                  ...current,
                                  [space.spaceId]: window,
                                }))
                              }
                            >
                              {formatAvailabilityWindow(window.startAt, window.endAt)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={loading}
                    onClick={() => void handleSelectSpace(space)}
                  >
                    {catalogFirstMode ? "Voir les créneaux" : "Réserver ce créneau"}
                  </button>
                </article>
              ))}
            </div>
          </>
        ) : null}

        {view === "calendar" && selectedSpace ? (
          <div className={styles.calendarPanel}>
            <h3 className={styles.calendarTitle}>Créneaux — {selectedSpace.name}</h3>
            <div className={styles.slotGrid}>
              {calendarSlots.map((slot) => {
                const selected =
                  selectedSlot?.startAt === slot.startAt && selectedSlot.endAt === slot.endAt;
                return (
                  <button
                    key={`${slot.startAt}-${slot.endAt}`}
                    type="button"
                    disabled={!slot.selectable || loading}
                    className={[
                      styles.slotButton,
                      !slot.selectable ? styles.slotButtonDisabled : "",
                      selected ? styles.slotButtonSelected : "",
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
