#!/usr/bin/env node
/**
 * Targeted cleanup of test reservations by reference.
 *
 * Default = dry-run (prints planned deletes, changes nothing).
 * Pass --execute to actually delete.
 *
 * Cascade (per reservation):
 *   payments → invoices → quotes → notifications → satisfactionSurveys
 *   → reservation → matching slotLocks
 * Does NOT delete shared spaces/buildings/discountCodes/cardex/clientAccounts
 * (unless --also-orphan-clients and the account has no remaining reservations/invoices).
 *
 * Usage:
 *   cd apps/vitrine/Backend && node scripts/cleanup-reservations-by-ref.mjs --refs RES-2026-00001,RES-2026-00002
 *   cd apps/vitrine/Backend && node scripts/cleanup-reservations-by-ref.mjs --refs RES-2026-00001 --execute
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  connectMongo,
  getClientAccountModel,
  getInvoiceModel,
  getNotificationModel,
  getPaymentModel,
  getQuoteModel,
  getReservationModel,
  getSatisfactionSurveyModel,
  getSlotLockModel,
  getCardexModel,
} from "@coworkprysme/db";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function parseArgs(argv) {
  const refs = [];
  let execute = false;
  let alsoOrphanClients = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--execute") {
      execute = true;
    } else if (arg === "--also-orphan-clients") {
      alsoOrphanClients = true;
    } else if (arg === "--refs") {
      const raw = argv[i + 1] ?? "";
      i += 1;
      refs.push(
        ...raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else if (arg.startsWith("--refs=")) {
      refs.push(
        ...arg
          .slice("--refs=".length)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
  }
  return { refs: [...new Set(refs)], execute, alsoOrphanClients };
}

function fmt(date) {
  if (!date) return "—";
  return new Date(date).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

async function planOne(models, reservation) {
  const { Invoice, Payment, Quote, Notification, SatisfactionSurvey, SlotLock } = models;
  const invoices = await Invoice.find({ reservationId: reservation._id }).lean();
  const invoiceIds = invoices.map((i) => i._id);
  const payments = invoiceIds.length
    ? await Payment.find({ invoiceId: { $in: invoiceIds } }).lean()
    : [];
  const quotes = await Quote.find({ reservationId: reservation._id }).lean();
  const notifications = await Notification.find({ reservationId: reservation._id }).lean();
  const surveys = await SatisfactionSurvey.find({ reservationId: reservation._id }).lean();
  const locks = await SlotLock.find({
    spaceId: reservation.spaceId,
    startAt: reservation.startAt,
    endAt: reservation.endAt,
  }).lean();

  return {
    reservation,
    invoices,
    payments,
    quotes,
    notifications,
    surveys,
    locks,
  };
}

async function main() {
  loadEnvFile(resolve(__dirname, "../.env"));
  const { refs, execute, alsoOrphanClients } = parseArgs(process.argv.slice(2));

  if (refs.length === 0) {
    console.error("Usage: node scripts/cleanup-reservations-by-ref.mjs --refs RES-…,RES-… [--execute]");
    process.exit(2);
  }

  await connectMongo();

  const models = {
    Reservation: await getReservationModel(),
    Invoice: await getInvoiceModel(),
    Payment: await getPaymentModel(),
    Quote: await getQuoteModel(),
    Notification: await getNotificationModel(),
    SatisfactionSurvey: await getSatisfactionSurveyModel(),
    SlotLock: await getSlotLockModel(),
    ClientAccount: await getClientAccountModel(),
    Cardex: await getCardexModel(),
  };

  const found = await models.Reservation.find({ reference: { $in: refs } }).lean();
  const foundRefs = new Set(found.map((r) => r.reference));
  const missing = refs.filter((r) => !foundRefs.has(r));

  console.log(execute ? "=== EXECUTE cleanup ===" : "=== DRY-RUN cleanup (aucune écriture) ===");
  console.log(`Refs demandées : ${refs.join(", ")}`);
  if (missing.length) {
    console.log(`Refs introuvables : ${missing.join(", ")}`);
  }
  console.log("");

  const plans = [];
  for (const reservation of found) {
    plans.push(await planOne(models, reservation));
  }

  let totals = {
    payments: 0,
    invoices: 0,
    quotes: 0,
    notifications: 0,
    surveys: 0,
    locks: 0,
    reservations: 0,
  };

  for (const plan of plans) {
    const r = plan.reservation;
    console.log(`--- ${r.reference} ---`);
    console.log(
      `  status=${r.status}  space=${r.spaceSnapshot?.name ?? r.spaceId}  ${fmt(r.startAt)} → ${fmt(r.endAt)}`,
    );
    console.log(`  payments          : ${plan.payments.length}`);
    for (const p of plan.payments) {
      console.log(`    - ${p._id}  method=${p.method}  amount=${p.amount}`);
    }
    console.log(`  invoices          : ${plan.invoices.length}`);
    for (const inv of plan.invoices) {
      console.log(`    - ${inv.reference}  status=${inv.status}`);
    }
    console.log(`  quotes            : ${plan.quotes.length}`);
    console.log(`  notifications     : ${plan.notifications.length}`);
    console.log(`  surveys           : ${plan.surveys.length}`);
    console.log(`  slotLocks match   : ${plan.locks.length}`);
    if (r.stripePaymentIntentId) {
      console.log(
        `  NOTE stripe PI     : ${r.stripePaymentIntentId} (annuler manuellement côté Stripe si encore ouvert)`,
      );
    }
    console.log(`  → delete reservation ${r.reference}`);

    totals.payments += plan.payments.length;
    totals.invoices += plan.invoices.length;
    totals.quotes += plan.quotes.length;
    totals.notifications += plan.notifications.length;
    totals.surveys += plan.surveys.length;
    totals.locks += plan.locks.length;
    totals.reservations += 1;
  }

  console.log("");
  console.log("Totaux prévus :", totals);

  if (!execute) {
    console.log("");
    console.log("Dry-run terminé. Relancer avec --execute pour appliquer.");
    process.exit(0);
  }

  for (const plan of plans) {
    const r = plan.reservation;
    const invoiceIds = plan.invoices.map((i) => i._id);
    if (invoiceIds.length) {
      await models.Payment.deleteMany({ invoiceId: { $in: invoiceIds } });
      await models.Invoice.deleteMany({ _id: { $in: invoiceIds } });
    }
    await models.Quote.deleteMany({ reservationId: r._id });
    await models.Notification.deleteMany({ reservationId: r._id });
    await models.SatisfactionSurvey.deleteMany({ reservationId: r._id });
    if (plan.locks.length) {
      await models.SlotLock.deleteMany({ _id: { $in: plan.locks.map((l) => l._id) } });
    }
    await models.Reservation.deleteOne({ _id: r._id });
    console.log(`Deleted ${r.reference}`);

    if (alsoOrphanClients && r.clientAccountId) {
      const otherRes = await models.Reservation.countDocuments({
        clientAccountId: r.clientAccountId,
      });
      const otherInv = r.cardexId
        ? await models.Invoice.countDocuments({ cardexId: r.cardexId })
        : 0;
      if (otherRes === 0 && otherInv === 0) {
        if (r.cardexId) await models.Cardex.deleteOne({ _id: r.cardexId });
        await models.ClientAccount.deleteOne({ _id: r.clientAccountId });
        console.log(`  + orphan clientAccount/cardex removed`);
      } else {
        console.log(
          `  keep client (otherRes=${otherRes}, otherInv=${otherInv})`,
        );
      }
    }
  }

  console.log("");
  console.log("Cleanup terminé.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
