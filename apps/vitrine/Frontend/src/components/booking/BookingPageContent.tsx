"use client";

import type { BookingLockResponse, BookingSpaceCard, SpaceType } from "@coworkprysme/shared";
import { formatCentsAsEuroString } from "@coworkprysme/shared";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { Container } from "@/components/ui/Container";
import { formatCountdown, useBookingLockCountdown } from "@/hooks/useBookingLock";
import { getBookingSessionId } from "@/lib/booking-session";
import {
  createBookingLock,
  fetchBookingAvailability,
  fetchBookingSpaces,
  fetchSpaceAvailability,
  monthRange,
  releaseBookingLock,
  toDatetimeLocalValue,
} from "@/lib/get-booking-api";

import { BookingProgressBar } from "./BookingProgressBar";
import styles from "./booking.module.css";

type BookingView = "search" | "results" | "calendar" | "locked";

function defaultStart(): string {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 2);
  return toDatetimeLocalValue(date);
}

function defaultEnd(startValue: string): string {
  const start = new Date(startValue);
  start.setHours(start.getHours() + 1);
  return toDatetimeLocalValue(start);
}

function formatSlotLabel(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return `${start.toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })} → ${end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

export function BookingPageContent() {
  const [view, setView] = useState<BookingView>("search");
  const [flexibleMode, setFlexibleMode] = useState(false);
  const [spaceType, setSpaceType] = useState<SpaceType>("meeting_room");
  const [partySize, setPartySize] = useState(4);
  const [startAt, setStartAt] = useState(defaultStart);
  const [endAt, setEndAt] = useState(() => defaultEnd(defaultStart()));
  const [spaces, setSpaces] = useState<BookingSpaceCard[]>([]);
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

  async function handleSearch() {
    setLoading(true);
    setError(null);
    setLockExpiredMessage(null);
    setLock(null);
    setSelectedSpace(null);
    setSelectedSlot(null);
    setCalendarSlots([]);

    try {
      if (flexibleMode) {
        const result = await fetchBookingSpaces({ spaceType, partySize });
        setSpaces(result);
        setView("results");
        return;
      }

      const startIso = new Date(startAt).toISOString();
      const endIso = new Date(endAt).toISOString();
      const result = await fetchBookingAvailability({
        spaceType,
        partySize,
        startAt: startIso,
        endAt: endIso,
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

    if (!flexibleMode) {
      setSelectedSlot({
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
      });
      await handleCreateLock(space, new Date(startAt).toISOString(), new Date(endAt).toISOString());
      return;
    }

    setLoading(true);
    try {
      const range = monthRange(new Date());
      const availability = await fetchSpaceAvailability(space.spaceId, range);
      setCalendarSlots(availability.slots);
      setView("calendar");
    } catch (calendarError) {
      setError(calendarError instanceof Error ? calendarError.message : "Calendrier indisponible");
    } finally {
      setLoading(false);
    }
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
    setView(flexibleMode ? "calendar" : "results");
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
            Recherchez un espace disponible aux dates souhaitées, ou parcourez le catalogue en mode
            flexible puis choisissez un créneau.
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

            <div className={styles.dateRow}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Début</span>
                <input
                  className={styles.fieldInput}
                  type="datetime-local"
                  value={startAt}
                  disabled={flexibleMode}
                  onChange={(event) => {
                    setStartAt(event.target.value);
                    setEndAt(defaultEnd(event.target.value));
                  }}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Fin</span>
                <input
                  className={styles.fieldInput}
                  type="datetime-local"
                  value={endAt}
                  disabled={flexibleMode}
                  onChange={(event) => setEndAt(event.target.value)}
                />
              </label>

              <button
                type="button"
                className={[styles.flexToggle, flexibleMode ? styles.flexToggleActive : ""]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setFlexibleMode((value) => !value)}
              >
                Flexible
              </button>
            </div>

            <div className={styles.searchActions}>
              <button className={styles.primaryButton} type="submit" disabled={loading}>
                {loading ? "Recherche…" : flexibleMode ? "Voir les espaces" : "Rechercher"}
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
                {flexibleMode ? "Espaces disponibles au catalogue" : "Espaces disponibles"}
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
                    {flexibleMode ? "Voir les créneaux" : "Réserver ce créneau"}
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
