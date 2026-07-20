import type { PlanningCalendarReservation, PlanningReservationDetail } from "@coworkprysme/shared";

import { formatCentsEur, formatDateTime } from "./planning-utils.js";

/** Escape text for ICS CONTENT-LINE values (RFC 5545). */
function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Format Date as UTC ICS timestamp: YYYYMMDDTHHMMSSZ */
function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function buildReservationIcs(input: {
  reservation: PlanningCalendarReservation;
  detail?: PlanningReservationDetail | null;
}): string {
  const { reservation, detail } = input;
  const spaceLabel = detail
    ? `${detail.space.name} · ${detail.space.buildingName}`
    : reservation.spaceName;
  const summary = `Cowork Prysme — ${spaceLabel}`;
  const description = [
    `Référence : ${reservation.reference}`,
    `Client : ${reservation.clientLabel}`,
    `Espace : ${spaceLabel}`,
    `Total TTC : ${formatCentsEur(reservation.totalTTC)}`,
  ].join("\n");
  const uid = `${reservation.reference}@coworkprysme.eu`;
  const now = toIcsUtc(new Date().toISOString());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cowork Prysme//Planning//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsUtc(reservation.startAt)}`,
    `DTEND:${toIcsUtc(reservation.endAt)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `LOCATION:${icsEscape(spaceLabel)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Trigger a .ics download suitable for Outlook / Apple Calendar / Google. */
export function downloadReservationIcs(input: {
  reservation: PlanningCalendarReservation;
  detail?: PlanningReservationDetail | null;
}): void {
  const ics = buildReservationIcs(input);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${input.reservation.reference}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function buildReservationRecapText(input: {
  reservation: PlanningCalendarReservation;
  detail?: PlanningReservationDetail | null;
}): string {
  const { reservation, detail } = input;
  const client =
    detail?.client.label ||
    [detail?.client.firstName, detail?.client.lastName].filter(Boolean).join(" ") ||
    reservation.clientLabel;
  const space = detail
    ? `${detail.space.name} · ${detail.space.buildingName}`
    : reservation.spaceName;
  return [
    `Client : ${client}`,
    `Espace : ${space}`,
    `Dates : ${formatDateTime(reservation.startAt)} → ${formatDateTime(reservation.endAt)}`,
    `Total TTC : ${formatCentsEur(reservation.totalTTC)}`,
    `Référence : ${reservation.reference}`,
  ].join("\n");
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
