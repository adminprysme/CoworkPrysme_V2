"use client";

import type {
  BookingLockResponse,
  BookingPhase1DurationClass,
  BookingPriceRequest,
  BookingServiceCatalogItem,
  BookingSpaceCard,
  SpaceType,
} from "@coworkprysme/shared";
import {
  DISCOUNT_CODE_PREFERENTIAL_PENDING_MESSAGE,
  formatCentsAsEuroString,
} from "@coworkprysme/shared";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { Container } from "@/components/ui/Container";
import {
  buildSearchWindowForRangeMode,
  defaultTimesForRangeMode,
  flexibleDurationClassHint,
  formatAvailabilityWindow,
  formatMonthHeading,
  isSameMonth,
  monthRange,
  multiMonthRange,
  resolveDateRangeInputMode,
  type BookingFlexibleDuration,
  type BookingSearchMode,
  type CalendarDurationFilter,
} from "@/lib/booking-date-utils";
import { buildRecurringReservationMailto } from "@/lib/booking-recurring-contact";
import { useBookingLockCountdown } from "@/hooks/useBookingLock";
import { useBookingPrice } from "@/hooks/useBookingPrice";
import { fetchBookingServices } from "@/lib/booking-price-api";
import { getBookingSessionId } from "@/lib/booking-session";
import {
  clearBookingRestoreSnapshot,
  loadBookingRestoreSnapshot,
  saveBookingRestoreSnapshot,
  type BookingRestoreSnapshot,
} from "@/lib/booking-restore";
import {
  createBookingLock,
  fetchActiveBookingLock,
  fetchBookingAvailability,
  fetchBookingSpaces,
  fetchSpaceAvailability,
  releaseBookingLock,
} from "@/lib/get-booking-api";

import { BookingFlexibleSearchPanel } from "./BookingFlexibleSearchPanel";
import { BookingSearchDateTimeFields } from "./BookingSearchDateTimeFields";
import { BookingSearchDateRangePicker } from "./BookingSearchDateRangePicker";
import {
  BookingSearchSummary,
  formatBookingDatesSearchSummary,
  formatBookingFlexibleSearchSummary,
} from "./BookingSearchSummary";
import { BookingProgressBar, type BookingProgressStepId } from "./BookingProgressBar";
import { BookingFloatingSummary } from "./BookingFloatingSummary";
import { BookingServicesStep, type BookingCartItem } from "./BookingServicesStep";
import { BOOKING_SPACE_CARD_IMAGE_SIZES } from "./booking-image-sizes";
import styles from "./booking.module.css";

type BookingView = "search" | "results" | "calendar" | "services";

type CalendarSlot = {
  startAt: string;
  endAt: string;
  durationClass: string;
  selectable: boolean;
};

function formatSlotLabel(startAt: string, endAt: string): string {
  return formatAvailabilityWindow(startAt, endAt);
}

interface BookingPageContentProps {
  contactEmail: string;
}

export function BookingPageContent({ contactEmail }: BookingPageContentProps) {
  const [view, setView] = useState<BookingView>("search");
  const [searchMode, setSearchMode] = useState<BookingSearchMode>("dates");
  const [spaceType, setSpaceType] = useState<SpaceType>("meeting_room");
  const [partySize, setPartySize] = useState(4);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const initialTimes = defaultTimesForRangeMode("same_day");
  const [startTime, setStartTime] = useState(initialTimes.startTime);
  const [endTime, setEndTime] = useState(initialTimes.endTime);
  const previousRangeModeRef = useRef(resolveDateRangeInputMode(null, null));
  const [flexDuration, setFlexDuration] = useState<BookingFlexibleDuration | null>(null);
  const [flexStartMonth, setFlexStartMonth] = useState<Date | null>(null);
  const [flexEndMonth, setFlexEndMonth] = useState<Date | null>(null);
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
  const [searchFormExpanded, setSearchFormExpanded] = useState(true);
  const shouldScrollAfterSearchRef = useRef(false);
  const searchErrorRef = useRef<HTMLParagraphElement>(null);
  const [durationClass, setDurationClass] = useState<BookingPhase1DurationClass | null>(null);
  const [catalogServices, setCatalogServices] = useState<BookingServiceCatalogItem[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [cart, setCart] = useState<BookingCartItem[]>([]);
  const [discountCode, setDiscountCode] = useState("");
  const [resumePending, setResumePending] = useState(true);

  const remainingMs = useBookingLockCountdown(lock?.expiresAt ?? null);

  const dateRangeMode = useMemo(
    () => resolveDateRangeInputMode(startDate, endDate),
    [startDate, endDate],
  );

  const recurringReservationMailto = useMemo(
    () =>
      buildRecurringReservationMailto(contactEmail, {
        spaceType,
        partySize,
      }),
    [contactEmail, partySize, spaceType],
  );

  useEffect(() => {
    if (previousRangeModeRef.current === dateRangeMode) {
      return;
    }

    const defaults = defaultTimesForRangeMode(dateRangeMode);
    setStartTime(defaults.startTime);
    setEndTime(defaults.endTime);
    previousRangeModeRef.current = dateRangeMode;
  }, [dateRangeMode]);

  const selectedRangeLabel = useMemo(() => {
    if (!selectedSlot) {
      return null;
    }
    return formatSlotLabel(selectedSlot.startAt, selectedSlot.endAt);
  }, [selectedSlot]);

  const flexibleMonthHeading = useMemo(() => {
    if (!flexStartMonth) {
      return null;
    }

    if (
      flexDuration === "month_plus" &&
      flexEndMonth &&
      !isSameMonth(flexStartMonth, flexEndMonth)
    ) {
      return `${formatMonthHeading(flexStartMonth)} – ${formatMonthHeading(flexEndMonth)}`;
    }

    return formatMonthHeading(flexStartMonth);
  }, [flexDuration, flexEndMonth, flexStartMonth]);

  const searchCollapsed =
    (view === "results" || view === "calendar") && spaces.length > 0 && !searchFormExpanded;

  const progressStep = useMemo<BookingProgressStepId>(() => {
    if (view === "services") {
      return "services";
    }
    return "space";
  }, [view]);

  const showFloatingSummary = Boolean(
    selectedSpace && (view === "results" || view === "calendar" || view === "services"),
  );

  const priceRequest = useMemo<BookingPriceRequest | null>(() => {
    if (!lock || !selectedSpace || !durationClass) {
      return null;
    }

    return {
      spaceId: selectedSpace.spaceId,
      startAt: lock.startAt,
      endAt: lock.endAt,
      durationClass,
      services: cart.map((item) => ({
        serviceId: item.serviceId,
        qty: item.qty,
        customAnswers: item.customAnswers,
      })),
      discountCode: discountCode.trim() || undefined,
    };
  }, [cart, discountCode, durationClass, lock, selectedSpace]);

  const { price, loading: priceLoading, error: priceError } = useBookingPrice(priceRequest);

  const promoMessage =
    priceError === DISCOUNT_CODE_PREFERENTIAL_PENDING_MESSAGE ? priceError : null;
  const promoError =
    priceError && priceError !== DISCOUNT_CODE_PREFERENTIAL_PENDING_MESSAGE ? priceError : null;

  const cartSummaryLines = useMemo(
    () =>
      cart.map((item) => {
        const priceLine = price?.lines.find(
          (line) => line.kind === "service" && line.refId === item.serviceId,
        );

        return {
          serviceId: item.serviceId,
          label: item.label,
          qty: item.qty,
          lineTotalTTC: priceLine?.totalTTC,
          answerSummary: item.customAnswers?.map(
            (answer) => `${answer.label} : ${String(answer.value)}`,
          ),
        };
      }),
    [cart, price],
  );

  const restoreSnapshot = useMemo((): BookingRestoreSnapshot | null => {
    if (!lock || !durationClass) {
      return null;
    }

    return {
      version: 1,
      lockId: lock.lockId,
      view,
      searchMode,
      spaceType,
      partySize,
      durationClass,
      flexDuration,
      flexStartMonth: flexStartMonth?.toISOString() ?? null,
      flexEndMonth: flexEndMonth?.toISOString() ?? null,
      startDate: startDate?.toISOString() ?? null,
      endDate: endDate?.toISOString() ?? null,
      startTime,
      endTime,
      cart,
      discountCode,
    };
  }, [
    cart,
    discountCode,
    durationClass,
    endDate,
    endTime,
    flexDuration,
    flexEndMonth,
    flexStartMonth,
    lock,
    partySize,
    searchMode,
    spaceType,
    startDate,
    startTime,
    view,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function tryResumeSession() {
      try {
        const sessionId = getBookingSessionId();
        const active = await fetchActiveBookingLock(sessionId);
        if (cancelled || !active.lock || !active.space) {
          return;
        }

        const snapshot = loadBookingRestoreSnapshot(active.lock.lockId);

        setLock(active.lock);
        setSelectedSpace(active.space);
        setSelectedSlot({ startAt: active.lock.startAt, endAt: active.lock.endAt });
        setDurationClass(snapshot?.durationClass ?? active.durationClass ?? "hourly");
        setPartySize(snapshot?.partySize ?? active.partySize ?? 4);
        setSpaces([active.space]);
        setSearchFormExpanded(false);

        if (snapshot) {
          setSearchMode(snapshot.searchMode);
          setSpaceType(snapshot.spaceType);
          setFlexDuration(snapshot.flexDuration);
          setFlexStartMonth(snapshot.flexStartMonth ? new Date(snapshot.flexStartMonth) : null);
          setFlexEndMonth(snapshot.flexEndMonth ? new Date(snapshot.flexEndMonth) : null);
          setStartDate(snapshot.startDate ? new Date(snapshot.startDate) : null);
          setEndDate(snapshot.endDate ? new Date(snapshot.endDate) : null);
          setStartTime(snapshot.startTime);
          setEndTime(snapshot.endTime);
          setCart(snapshot.cart);
          setDiscountCode(snapshot.discountCode);
        }

        setView("services");
      } catch {
        // Resume is best-effort; fall back to a fresh search flow.
      } finally {
        if (!cancelled) {
          setResumePending(false);
        }
      }
    }

    void tryResumeSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!restoreSnapshot) {
      return;
    }

    saveBookingRestoreSnapshot(restoreSnapshot);
  }, [restoreSnapshot]);

  function showSearchResults(result: BookingSpaceCard[]) {
    shouldScrollAfterSearchRef.current = true;
    setSpaces(result);
    setSearchFormExpanded(false);
    setView("results");
  }

  const searchSummaryLabel = useMemo(() => {
    if (searchMode === "flexible") {
      if (!flexDuration || !flexStartMonth) {
        return null;
      }
      if (flexDuration === "month_plus" && !flexEndMonth) {
        return null;
      }
      return formatBookingFlexibleSearchSummary({
        spaceType,
        partySize,
        duration: flexDuration,
        startMonth: flexStartMonth,
        endMonth: flexEndMonth,
      });
    }

    if (!startDate || !endDate) {
      return null;
    }

    return formatBookingDatesSearchSummary({
      spaceType,
      partySize,
      startDate,
      endDate,
      startTime,
      endTime,
    });
  }, [
    endDate,
    endTime,
    flexDuration,
    flexEndMonth,
    flexStartMonth,
    partySize,
    searchMode,
    spaceType,
    startDate,
    startTime,
  ]);

  function handleFlexDurationChange(duration: BookingFlexibleDuration) {
    setFlexDuration(duration);
    if (duration === "month_plus") {
      setFlexEndMonth(null);
      return;
    }

    if (flexStartMonth) {
      setFlexEndMonth(flexStartMonth);
    }
  }

  function handleFlexMonthRangeChange(start: Date | null, end: Date | null) {
    setFlexStartMonth(start);
    setFlexEndMonth(end);
  }

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

  function reportSearchError(message: string) {
    setError(message);
    setView("search");
    requestAnimationFrame(() => {
      searchErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

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
          reportSearchError("Choisissez une durée de réservation.");
          return;
        }
        if (!flexStartMonth) {
          reportSearchError("Choisissez un mois de réservation.");
          return;
        }
        if (flexDuration === "month_plus" && !flexEndMonth) {
          reportSearchError("Choisissez la plage de mois (début et fin).");
          return;
        }

        const result = await fetchBookingSpaces({ spaceType, partySize });
        showSearchResults(result);
        return;
      }

      if (!startDate || !endDate) {
        reportSearchError("Sélectionnez une plage de dates dans le calendrier.");
        return;
      }

      const window = buildSearchWindowForRangeMode(
        startDate,
        endDate,
        dateRangeMode,
        startTime,
        endTime,
      );
      if (new Date(window.endAt) <= new Date(window.startAt)) {
        reportSearchError("L'heure de fin doit être postérieure à l'heure de début.");
        return;
      }

      const result = await fetchBookingAvailability({
        spaceType,
        partySize,
        startAt: window.startAt,
        endAt: window.endAt,
      });
      showSearchResults(result);
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
      if (!flexStartMonth || !flexDuration) {
        setError("Sélectionnez une durée et un mois avant de choisir un espace.");
        return;
      }
      if (flexDuration === "month_plus" && !flexEndMonth) {
        setError("Sélectionnez la plage de mois avant de choisir un espace.");
        return;
      }

      setLoading(true);
      try {
        setCalendarMonth(flexStartMonth);
        setCalendarDurationFilter(flexibleDurationClassHint(flexDuration));
        const range =
          flexDuration === "month_plus" && flexEndMonth
            ? multiMonthRange(flexStartMonth, flexEndMonth)
            : monthRange(flexStartMonth);
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

    const window = buildSearchWindowForRangeMode(
      startDate,
      endDate,
      dateRangeMode,
      startTime,
      endTime,
    );
    await handleCreateLock(
      space,
      window.startAt,
      window.endAt,
      dateRangeMode === "same_day" ? "hourly" : "daily",
    );
  }

  async function handleCreateLock(
    space: BookingSpaceCard,
    slotStartAt: string,
    slotEndAt: string,
    slotDurationClass: BookingPhase1DurationClass,
  ) {
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
        durationClass: slotDurationClass,
      });
      setLock(response);
      setSelectedSlot({ startAt: slotStartAt, endAt: slotEndAt });
      setDurationClass(slotDurationClass);
      setCart([]);
      setDiscountCode("");
      setView("services");
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

  useEffect(() => {
    if (view !== "services" || !selectedSpace) {
      return;
    }

    setServicesLoading(true);
    void fetchBookingServices({ buildingId: selectedSpace.buildingId })
      .then(setCatalogServices)
      .catch((servicesError: unknown) => {
        setError(servicesError instanceof Error ? servicesError.message : "Services indisponibles");
      })
      .finally(() => setServicesLoading(false));
  }, [selectedSpace, view]);

  useEffect(() => {
    if (!shouldScrollAfterSearchRef.current || !searchCollapsed) {
      return;
    }

    shouldScrollAfterSearchRef.current = false;

    if (typeof window === "undefined" || !window.matchMedia("(max-width: 640px)").matches) {
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [searchCollapsed]);

  useEffect(() => {
    if (remainingMs !== 0 || !lock) {
      return;
    }

    const sessionId = getBookingSessionId();
    void releaseBookingLock(lock.lockId, sessionId);
    clearBookingRestoreSnapshot();
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
            Indiquez le type d&apos;espace, le nombre de personnes et vos disponibilités pour
            découvrir les lieux disponibles et finaliser votre réservation.
          </p>
        </div>

        <BookingProgressBar activeStep={progressStep} />

        {resumePending ? (
          <p className={styles.resumePending} role="status" aria-live="polite">
            Reprise de votre réservation…
          </p>
        ) : (
          <div
            className={[
              styles.bookingLayout,
              showFloatingSummary ? styles.bookingLayoutWithSummary : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className={styles.bookingMain}>
              {(view === "search" || view === "results" || view === "calendar") && (
                <form
                  className={[styles.searchForm, searchCollapsed ? styles.searchFormCompact : ""]
                    .filter(Boolean)
                    .join(" ")}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSearch();
                  }}
                >
                  <div
                    className={[
                      styles.searchFormPanel,
                      searchCollapsed ? styles.searchFormPanelHidden : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-hidden={searchCollapsed}
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
                            recurringReservationMailto={recurringReservationMailto}
                            onRangeChange={(start, end) => {
                              setStartDate(start);
                              setEndDate(end);
                            }}
                          />

                          <BookingSearchDateTimeFields
                            mode={dateRangeMode}
                            startDate={startDate}
                            endDate={endDate}
                            startTime={startTime}
                            endTime={endTime}
                            onStartTimeChange={setStartTime}
                            onEndTimeChange={setEndTime}
                          />
                        </>
                      ) : (
                        <BookingFlexibleSearchPanel
                          duration={flexDuration}
                          onDurationChange={handleFlexDurationChange}
                          selectedStartMonth={flexStartMonth}
                          selectedEndMonth={flexEndMonth}
                          onMonthRangeChange={handleFlexMonthRangeChange}
                        />
                      )}
                    </div>
                  </div>

                  {!searchCollapsed ? (
                    <div className={styles.searchFormFooter}>
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
                              setSearchFormExpanded(true);
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
                    </div>
                  ) : null}

                  {searchCollapsed && searchSummaryLabel ? (
                    <div className={styles.searchFormSummaryPanel}>
                      <BookingSearchSummary
                        summary={searchSummaryLabel}
                        onEdit={() => setSearchFormExpanded(true)}
                        recurringMailto={
                          searchMode === "dates" ? recurringReservationMailto : undefined
                        }
                      />
                    </div>
                  ) : null}

                  {error ? (
                    <p
                      ref={searchErrorRef}
                      role="alert"
                      className={`${styles.message} ${styles.messageError}`}
                    >
                      {error}
                    </p>
                  ) : null}
                  {lockExpiredMessage ? (
                    <p className={`${styles.message} ${styles.messageInfo}`}>
                      {lockExpiredMessage}
                    </p>
                  ) : null}
                </form>
              )}

              {(view === "results" || view === "calendar") && spaces.length > 0 ? (
                <>
                  <div
                    className={[
                      styles.resultsHeader,
                      searchCollapsed ? styles.resultsHeaderCompact : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
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
                                sizes={BOOKING_SPACE_CARD_IMAGE_SIZES}
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
                                {space.priceFromLabel
                                  ? ` / ${space.priceFromLabel.toLowerCase()}`
                                  : ""}
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
                    Créneaux — {selectedSpace.name} ·{" "}
                    {flexibleMonthHeading ?? formatMonthHeading(calendarMonth)}
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
                          calendarDurationFilter === option.value
                            ? styles.calendarFilterPillActive
                            : "",
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
                          onClick={() =>
                            void handleCreateLock(
                              selectedSpace,
                              slot.startAt,
                              slot.endAt,
                              slot.durationClass as BookingPhase1DurationClass,
                            )
                          }
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

              {view === "services" && lock && selectedSpace ? (
                <BookingServicesStep
                  services={catalogServices}
                  cart={cart}
                  loading={servicesLoading}
                  onCartChange={setCart}
                  onBack={() => setView(searchMode === "flexible" ? "calendar" : "results")}
                />
              ) : null}
            </div>

            {showFloatingSummary ? (
              <BookingFloatingSummary
                searchSummary={searchSummaryLabel}
                spaceLabel={selectedSpace?.name ?? null}
                slotLabel={selectedRangeLabel}
                services={cartSummaryLines}
                price={price}
                priceLoading={priceLoading}
                lockCountdownMs={lock ? remainingMs : null}
                expandedByDefault={view === "services"}
                showPromoField={view === "services"}
                discountCode={discountCode}
                onDiscountCodeChange={setDiscountCode}
                promoMessage={promoMessage}
                promoError={promoError}
              />
            ) : null}
          </div>
        )}
      </Container>
    </section>
  );
}
