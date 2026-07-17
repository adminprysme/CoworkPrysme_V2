#!/usr/bin/env node
/**
 * Read-only inventory of all reservations in cowork_bdd.
 * Shows references, statuses, slots, and linked invoices/payments.
 * Does NOT modify any data.
 *
 * Usage:
 *   cd apps/vitrine/Backend && node scripts/list-reservations.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BLOCKING_RESERVATION_STATUSES,
  connectMongo,
  getInvoiceModel,
  getPaymentModel,
  getReservationModel,
  getSlotLockModel,
} from "@coworkprysme/db";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load .env without requiring quotes around values that contain spaces. */
function loadEnvFile(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function fmt(date) {
  if (!date) return "—";
  return new Date(date).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function euros(cents) {
  if (typeof cents !== "number") return "—";
  return `${(cents / 100).toFixed(2)} €`;
}

function pad(value, width) {
  const text = String(value ?? "");
  return text.length >= width ? text : `${text}${" ".repeat(width - text.length)}`;
}

async function main() {
  loadEnvFile(resolve(__dirname, "../.env"));
  await connectMongo();

  const Reservation = await getReservationModel();
  const Invoice = await getInvoiceModel();
  const Payment = await getPaymentModel();
  const SlotLock = await getSlotLockModel();

  const reservations = await Reservation.find({})
    .sort({ startAt: 1, reference: 1 })
    .lean();

  const reservationIds = reservations.map((r) => r._id);
  const invoices = reservationIds.length
    ? await Invoice.find({ reservationId: { $in: reservationIds } }).lean()
    : [];
  const invoicesByReservation = new Map();
  for (const inv of invoices) {
    const key = String(inv.reservationId);
    if (!invoicesByReservation.has(key)) invoicesByReservation.set(key, []);
    invoicesByReservation.get(key).push(inv);
  }

  const invoiceIds = invoices.map((i) => i._id);
  const payments = invoiceIds.length
    ? await Payment.find({ invoiceId: { $in: invoiceIds } }).lean()
    : [];
  const paymentsByInvoice = new Map();
  for (const pay of payments) {
    const key = String(pay.invoiceId);
    if (!paymentsByInvoice.has(key)) paymentsByInvoice.set(key, []);
    paymentsByInvoice.get(key).push(pay);
  }

  const now = new Date();
  const activeLocks = await SlotLock.find({ expiresAt: { $gte: now } })
    .sort({ startAt: 1 })
    .lean();

  const blockingSet = new Set(BLOCKING_RESERVATION_STATUSES);
  const blocking = reservations.filter((r) => blockingSet.has(r.status));
  const byStatus = {};
  for (const r of reservations) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }

  console.log("=== Réservations (lecture seule) ===");
  console.log(`Total             : ${reservations.length}`);
  console.log(
    `Bloquantes*       : ${blocking.length}  (* ${BLOCKING_RESERVATION_STATUSES.join(", ")})`,
  );
  console.log(
    `Par statut        : ${
      Object.keys(byStatus).length
        ? Object.entries(byStatus)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([s, n]) => `${s}=${n}`)
            .join(", ")
        : "(aucune)"
    }`,
  );
  console.log(`Slot locks actifs : ${activeLocks.length}`);
  console.log("");

  if (reservations.length === 0) {
    console.log("(aucune réservation en base)");
  } else {
    console.log(
      [
        pad("REF", 16),
        pad("STATUS", 18),
        pad("BLOCK?", 7),
        pad("SPACE", 22),
        pad("START (UTC)", 22),
        pad("END (UTC)", 22),
        pad("PAY", 14),
        pad("TTC", 10),
        "INVOICES / PAYMENTS",
      ].join(" "),
    );
    console.log("-".repeat(160));

    for (const r of reservations) {
      const spaceName = r.spaceSnapshot?.name ?? String(r.spaceId);
      const invs = invoicesByReservation.get(String(r._id)) ?? [];
      const invParts = invs.map((inv) => {
        const pays = paymentsByInvoice.get(String(inv._id)) ?? [];
        const paySummary =
          pays.length === 0
            ? "no-pay"
            : pays.map((p) => `${p.method}:${euros(p.amount)}`).join("+");
        return `${inv.reference}[${inv.status}/${paySummary}]`;
      });

      console.log(
        [
          pad(r.reference, 16),
          pad(r.status, 18),
          pad(blockingSet.has(r.status) ? "YES" : "no", 7),
          pad(String(spaceName).slice(0, 22), 22),
          pad(fmt(r.startAt), 22),
          pad(fmt(r.endAt), 22),
          pad(r.awaitingPaymentMethod ?? "—", 14),
          pad(euros(r.pricing?.ttc), 10),
          invParts.join("; ") || "—",
        ].join(" "),
      );

      if (r.stripePaymentIntentId) {
        console.log(`                 stripe PI: ${r.stripePaymentIntentId}`);
      }
      if (r.awaitingPaymentExpiresAt) {
        console.log(`                 expire hold: ${fmt(r.awaitingPaymentExpiresAt)}`);
      }
    }
  }

  if (activeLocks.length > 0) {
    console.log("");
    console.log("=== Slot locks actifs (tunnel pré-réservation) ===");
    for (const lock of activeLocks) {
      console.log(
        `  space=${lock.spaceId}  ${fmt(lock.startAt)} → ${fmt(lock.endAt)}  expires=${fmt(lock.expiresAt)}  session=${lock.sessionId}`,
      );
    }
  }

  console.log("");
  console.log("Rien n'a été modifié.");
  console.log("Ensuite, pour un dry-run de nettoyage ciblé :");
  console.log(
    "  cd apps/vitrine/Backend && node scripts/cleanup-reservations-by-ref.mjs --refs RES-…,RES-…",
  );
  console.log("Puis avec --execute uniquement après validation de la liste.");

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
