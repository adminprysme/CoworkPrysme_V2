import type { Types } from "mongoose";

import {
  BANK_TRANSFER_REMINDER_OFFSET_DAYS,
  BANK_TRANSFER_REMINDER_TIERS,
  type BankTransferReminderTier,
} from "@coworkprysme/shared";

import { connectMongo } from "../../connection.js";
import { getInvoiceModel } from "../billing/invoice.schema.js";
import { getReservationModel } from "../reservation/reservation.schema.js";

export interface BankTransferReminderCandidate {
  reservationId: string;
  reference: string;
  clientAccountId: string;
  buildingId: string;
  invoiceId: string;
  invoiceReference: string;
  amountCents: number;
  issuedAt: Date;
  expiresAt: Date;
  tier: BankTransferReminderTier;
  spaceName: string;
  startAt: Date;
  endAt: Date;
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Find bank_transfer holds that are due for a reminder tier and not yet emailed for that tier.
 * Only unpaid invoices; skips holds already past expiry (expiry sweeper handles those).
 *
 * Invoices are loaded in one batch (`reservationId ∈ holdIds`) — not N+1.
 */
export async function findDueBankTransferReminders(
  now: Date = new Date(),
): Promise<BankTransferReminderCandidate[]> {
  await connectMongo();
  const Reservation = await getReservationModel();
  const Invoice = await getInvoiceModel();

  const holds = await Reservation.find({
    status: "awaiting_payment",
    awaitingPaymentMethod: "bank_transfer",
    awaitingPaymentExpiresAt: { $gt: now },
  })
    .lean()
    .exec();

  if (holds.length === 0) {
    return [];
  }

  const holdIds = holds.map((hold) => hold._id);
  const invoices = await Invoice.find({ reservationId: { $in: holdIds } })
    .lean()
    .exec();
  const invoiceByReservationId = new Map<string, (typeof invoices)[number]>();
  for (const invoice of invoices) {
    if (!invoice.reservationId) {
      continue;
    }
    invoiceByReservationId.set(invoice.reservationId.toString(), invoice);
  }

  const due: BankTransferReminderCandidate[] = [];

  for (const hold of holds) {
    if (!hold.clientAccountId) {
      continue;
    }
    const invoice = invoiceByReservationId.get(hold._id.toString());
    if (!invoice || invoice.totals.balanceDue <= 0 || invoice.status === "paid") {
      continue;
    }

    const issuedAt = invoice.issuedAt ?? invoice.createdAt;
    const sent = new Set(hold.bankTransferRemindersSent ?? []);

    for (const tier of BANK_TRANSFER_REMINDER_TIERS) {
      if (sent.has(tier)) {
        continue;
      }
      const dueAt = addUtcDays(issuedAt, BANK_TRANSFER_REMINDER_OFFSET_DAYS[tier]);
      if (now.getTime() < dueAt.getTime()) {
        continue;
      }

      due.push({
        reservationId: hold._id.toString(),
        reference: hold.reference,
        clientAccountId: hold.clientAccountId.toString(),
        buildingId: hold.buildingId.toString(),
        invoiceId: invoice._id.toString(),
        invoiceReference: invoice.reference,
        amountCents: invoice.totals.balanceDue,
        issuedAt,
        expiresAt: hold.awaitingPaymentExpiresAt as Date,
        tier,
        spaceName: hold.spaceSnapshot.name,
        startAt: hold.startAt,
        endAt: hold.endAt,
      });
      // One tier per sweep pass (oldest first via array order).
      break;
    }
  }

  return due;
}

/** Atomically mark a reminder tier as sent (no-op if already present or reservation confirmed). */
export async function markBankTransferReminderSent(
  reservationId: Types.ObjectId | string,
  tier: BankTransferReminderTier,
): Promise<boolean> {
  await connectMongo();
  const Reservation = await getReservationModel();
  const result = await Reservation.updateOne(
    {
      _id: reservationId,
      status: "awaiting_payment",
      awaitingPaymentMethod: "bank_transfer",
      bankTransferRemindersSent: { $ne: tier },
    },
    { $addToSet: { bankTransferRemindersSent: tier } },
  ).exec();
  return result.modifiedCount === 1;
}
