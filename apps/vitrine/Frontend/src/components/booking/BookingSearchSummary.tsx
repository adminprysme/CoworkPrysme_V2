import type { SpaceType } from "@coworkprysme/shared";

import {
  FLEXIBLE_DURATION_OPTIONS,
  formatMonthHeading,
  isSameDay,
  type BookingFlexibleDuration,
} from "@/lib/booking-date-utils";

import { BookingRecurringReservationHint } from "./BookingRecurringReservationHint";
import summaryStyles from "./BookingSearchSummary.module.css";

const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  meeting_room: "Salle de réunion",
  private_office: "Bureau privatif",
};

export function formatBookingDatesSearchSummary(input: {
  spaceType: SpaceType;
  partySize: number;
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
}): string {
  const typeLabel = SPACE_TYPE_LABELS[input.spaceType];
  const peopleLabel = `${input.partySize} personne${input.partySize > 1 ? "s" : ""}`;
  const startFmt = input.startDate.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const endFmt = input.endDate.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const dateTimeLabel = isSameDay(input.startDate, input.endDate)
    ? `${startFmt}, ${input.startTime}–${input.endTime}`
    : `Du ${startFmt} au ${endFmt}, ${input.startTime}–${input.endTime}`;

  return `${typeLabel} · ${peopleLabel} · ${dateTimeLabel}`;
}

export function formatBookingFlexibleSearchSummary(input: {
  spaceType: SpaceType;
  partySize: number;
  duration: BookingFlexibleDuration;
  startMonth: Date;
  endMonth: Date | null;
}): string {
  const typeLabel = SPACE_TYPE_LABELS[input.spaceType];
  const peopleLabel = `${input.partySize} personne${input.partySize > 1 ? "s" : ""}`;
  const durationLabel =
    FLEXIBLE_DURATION_OPTIONS.find((option) => option.value === input.duration)?.label ??
    "Flexible";

  let monthLabel = formatMonthHeading(input.startMonth);
  if (
    input.duration === "month_plus" &&
    input.endMonth &&
    (input.startMonth.getMonth() !== input.endMonth.getMonth() ||
      input.startMonth.getFullYear() !== input.endMonth.getFullYear())
  ) {
    monthLabel = `${formatMonthHeading(input.startMonth)} – ${formatMonthHeading(input.endMonth)}`;
  }

  return `${typeLabel} · ${peopleLabel} · ${durationLabel} · ${monthLabel}`;
}

interface BookingSearchSummaryProps {
  summary: string;
  onEdit: () => void;
  recurringMailto?: string;
}

export function BookingSearchSummary({
  summary,
  onEdit,
  recurringMailto,
}: BookingSearchSummaryProps) {
  return (
    <div className={summaryStyles.searchSummary}>
      <div className={summaryStyles.searchSummaryBar}>
        <p className={summaryStyles.searchSummaryText}>{summary}</p>
        <button type="button" className={summaryStyles.searchSummaryEdit} onClick={onEdit}>
          Modifier la recherche
        </button>
      </div>
      {recurringMailto ? (
        <BookingRecurringReservationHint mailto={recurringMailto} compact />
      ) : null}
    </div>
  );
}

export { summaryStyles };
