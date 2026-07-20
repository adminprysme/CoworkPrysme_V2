/**
 * Pure calculation proofs for Planning Manage date shorten/extend.
 * Does not mutate DB — uses shared helpers only.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import {
  classifyDateChange,
  computeCgvScaleRatio,
  computeCgvScaleRefundCents,
  computeShortenRefundSuggestion,
  countBillableUnits,
} from "@coworkprysme/shared";

const outDir = new URL("./manage-dates-calc-proof/", import.meta.url);
mkdirSync(outDir, { recursive: true });

// --- 1) CGV barème before start (daily, 50% band: 3–7 days) ---
const dailyStart = new Date("2026-08-10T06:00:00.000Z");
const dailyEnd = new Date("2026-08-12T17:00:00.000Z"); // 2 daily units
const nowCgv = new Date("2026-08-05T12:00:00.000Z"); // ~4.75 days before → 50%
const cgvScale = computeCgvScaleRatio({
  durationClass: "daily",
  startAt: dailyStart,
  now: nowCgv,
});
const paidTotalCents = 20_000;
const shortenedEnd = new Date("2026-08-11T17:00:00.000Z"); // remove 1 day
const shortenCgv = computeShortenRefundSuggestion({
  durationClass: "daily",
  oldStart: dailyStart,
  oldEnd: dailyEnd,
  newStart: dailyStart,
  newEnd: shortenedEnd,
  paidTotalCents,
  now: nowCgv,
});
const cgvFull = computeCgvScaleRefundCents({
  durationClass: "daily",
  startAt: dailyStart,
  paidTotalCents,
  now: nowCgv,
});

const proofCgvBeforeStart = {
  case: "shorten_before_start_cgv_50pct",
  durationClass: "daily",
  original: { startAt: dailyStart.toISOString(), endAt: dailyEnd.toISOString() },
  shortened: { startAt: dailyStart.toISOString(), endAt: shortenedEnd.toISOString() },
  now: nowCgv.toISOString(),
  paidTotalCents,
  cgvScale,
  fullCancelSuggestedIfEntire: cgvFull,
  shortenSuggestion: shortenCgv,
  detail: [
    `Hours/days before original start → band ${cgvScale.band}, ratio ${cgvScale.ratio}`,
    `Removed portion value = round(${paidTotalCents} × removedMs/oldMs) = ${shortenCgv.removedValueCents}¢`,
    `CGV ratio ${cgvScale.ratio} applied → suggestedRefundCents = ${shortenCgv.suggestedRefundCents}¢`,
  ],
};

// --- 2) Prorata in progress (shorten end while stay ongoing) ---
const progStart = new Date("2026-07-20T06:00:00.000Z");
const progEnd = new Date("2026-07-20T18:00:00.000Z"); // 12h
const nowProg = new Date("2026-07-20T10:00:00.000Z"); // 4h elapsed, 8h remain
const progShortEnd = new Date("2026-07-20T14:00:00.000Z"); // remove last 4h
const shortenProrata = computeShortenRefundSuggestion({
  durationClass: "hourly",
  oldStart: progStart,
  oldEnd: progEnd,
  newStart: progStart,
  newEnd: progShortEnd,
  paidTotalCents: 12_000,
  now: nowProg,
});

const proofProrataInProgress = {
  case: "shorten_in_progress_prorata_removed",
  durationClass: "hourly",
  original: { startAt: progStart.toISOString(), endAt: progEnd.toISOString() },
  shortened: { startAt: progStart.toISOString(), endAt: progShortEnd.toISOString() },
  now: nowProg.toISOString(),
  paidTotalCents: 12_000,
  shortenSuggestion: shortenProrata,
  detail: [
    "Stay already started → CGV scale not used; prorata on removed portion",
    `removedMs/oldMs × paid = ${shortenProrata.removedValueCents}¢ → suggested ${shortenProrata.suggestedRefundCents}¢`,
    `basis=${shortenProrata.basis}`,
  ],
};

// --- 3) Extend recalculation (billable units × tariff) ---
const extStart = new Date("2026-09-01T06:00:00.000Z");
const extOldEnd = new Date("2026-09-02T17:00:00.000Z");
const extNewEnd = new Date("2026-09-04T17:00:00.000Z");
const kind = classifyDateChange({
  oldStart: extStart,
  oldEnd: extOldEnd,
  newStart: extStart,
  newEnd: extNewEnd,
});
const prevUnits = countBillableUnits(extStart, extOldEnd, "daily");
const nextUnits = countBillableUnits(extStart, extNewEnd, "daily");
const unitPriceHT = 10_000; // 100,00 € HT / day
const vatRate = 20;
const prevHT = prevUnits * unitPriceHT;
const nextHT = nextUnits * unitPriceHT;
const complementHT = nextHT - prevHT;
const complementVAT = Math.round((complementHT * vatRate) / 100);
const complementTTC = complementHT + complementVAT;
const prevTTC = prevHT + Math.round((prevHT * vatRate) / 100);
const nextTTC = nextHT + Math.round((nextHT * vatRate) / 100);

const proofExtend = {
  case: "extend_recalc_units",
  kind,
  durationClass: "daily",
  unitPriceHT,
  vatRate,
  previous: { endAt: extOldEnd.toISOString(), units: prevUnits, spaceHT: prevHT, spaceTTC: prevTTC },
  next: { endAt: extNewEnd.toISOString(), units: nextUnits, spaceHT: nextHT, spaceTTC: nextTTC },
  complement: { ht: complementHT, vat: complementVAT, ttc: complementTTC },
  detail: [
    `classifyDateChange → ${kind}`,
    `units ${prevUnits} → ${nextUnits} (Paris inclusive days)`,
    `complement TTC = ${complementTTC}¢ (post-master append line; snapshot not rewritten)`,
  ],
};

const proof = {
  generatedAt: new Date().toISOString(),
  cgvBeforeStart: proofCgvBeforeStart,
  prorataInProgress: proofProrataInProgress,
  extendRecalc: proofExtend,
};

writeFileSync(new URL("./proof.json", outDir), JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof, null, 2));
