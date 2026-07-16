import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { connectMongo, getCoworkDb } from "../../connection.js";
import { getInvoiceModel, registerInvoiceModel } from "../../domains/billing/invoice.schema.js";
import {
  findDueBankTransferReminders,
  markBankTransferReminderSent,
} from "../../domains/booking/bank-transfer-reminders.js";
import { expireAwaitingPaymentReservations } from "../../domains/booking/expire-awaiting-payment-reservations.js";
import {
  createReservation,
  ensureReservationIndexes,
  getReservationModel,
  registerReservationModel,
  registerSlotLockModel,
} from "../../domains/reservation/index.js";
import {
  clearCoworkCollections,
  configureIntegrationEnv,
  startIntegrationMongo,
  stopIntegrationMongo,
} from "./setup.js";

async function seedBankTransferHold(input: {
  reference: string;
  issuedAt: Date;
  expiresAt: Date;
  startAt: Date;
  endAt: Date;
  remindersSent?: ("j2" | "j4" | "j6")[];
}) {
  const spaceId = new Types.ObjectId();
  const buildingId = new Types.ObjectId();
  const clientAccountId = new Types.ObjectId();
  const cardexId = new Types.ObjectId();
  const now = input.issuedAt;

  const reservation = await createReservation({
    reference: input.reference,
    spaceId,
    spaceSnapshot: { name: "Salle Virement", type: "meeting_room" },
    buildingId,
    type: "meeting_room",
    startAt: input.startAt,
    endAt: input.endAt,
    durationClass: "hourly",
    partySize: 4,
    status: "awaiting_payment",
    statusHistory: [{ from: "pending", to: "awaiting_payment", at: now }],
    services: [],
    pricing: { subtotalHT: 10000, totalVAT: 2000, totalTTC: 12000, discountTotal: 0 },
    clientAccountId,
    awaitingPaymentExpiresAt: input.expiresAt,
    awaitingPaymentMethod: "bank_transfer",
    bankTransferRemindersSent: input.remindersSent ?? [],
    createdChannel: "online",
  });

  const Invoice = await getInvoiceModel();
  await Invoice.create({
    reference: `PF-${input.reference}`,
    type: "proforma",
    status: "proforma",
    currency: "EUR",
    cardexId,
    reservationId: reservation._id,
    lines: [
      {
        kind: "space",
        label: "Salle Virement",
        qty: 1,
        unitPriceHT: 10000,
        vatRate: 20,
        discount: 0,
        totalHT: 10000,
        totalVAT: 2000,
        totalTTC: 12000,
      },
    ],
    vatBreakdown: [{ rate: 20, baseHT: 10000, vat: 2000 }],
    totals: {
      ht: 10000,
      vat: 2000,
      ttc: 12000,
      paidTotal: 0,
      balanceDue: 12000,
      discountTotal: 0,
    },
    paymentSituation: "on_quote",
    issuedAt: input.issuedAt,
  });

  return { reservation, clientAccountId, buildingId, spaceId };
}

describe("bank transfer reminders + expiry", () => {
  beforeAll(async () => {
    const uri = await startIntegrationMongo();
    await configureIntegrationEnv(uri);
    await connectMongo();
    const connection = await getCoworkDb();
    registerSlotLockModel(connection);
    registerReservationModel(connection);
    registerInvoiceModel(connection);
    await ensureReservationIndexes();
  }, 120_000);

  afterEach(async () => {
    await clearCoworkCollections();
  });

  afterAll(async () => {
    await stopIntegrationMongo();
  });

  it("schedules reminder tiers from issuedAt for a 10-day lead reservation", async () => {
    const issuedAt = new Date("2026-07-01T10:00:00.000Z");
    const startAt = new Date("2026-07-11T10:00:00.000Z");
    const endAt = new Date("2026-07-11T12:00:00.000Z");
    const expiresAt = new Date("2026-07-09T10:00:00.000Z");

    await seedBankTransferHold({
      reference: "RES-2026-BT10",
      issuedAt,
      expiresAt,
      startAt,
      endAt,
    });

    // Before J+2 — nothing due
    await expect(
      findDueBankTransferReminders(new Date("2026-07-02T09:00:00.000Z")),
    ).resolves.toEqual([]);

    // At J+2 — j2 due
    const atJ2 = await findDueBankTransferReminders(new Date("2026-07-03T11:00:00.000Z"));
    expect(atJ2).toHaveLength(1);
    expect(atJ2[0]?.tier).toBe("j2");
    expect(atJ2[0]?.reference).toBe("RES-2026-BT10");

    await markBankTransferReminderSent(atJ2[0]!.reservationId, "j2");

    // At J+4 — j4 due (j2 already sent)
    const atJ4 = await findDueBankTransferReminders(new Date("2026-07-05T11:00:00.000Z"));
    expect(atJ4).toHaveLength(1);
    expect(atJ4[0]?.tier).toBe("j4");

    await markBankTransferReminderSent(atJ4[0]!.reservationId, "j4");

    // At J+6 — j6 due
    const atJ6 = await findDueBankTransferReminders(new Date("2026-07-07T11:00:00.000Z"));
    expect(atJ6).toHaveLength(1);
    expect(atJ6[0]?.tier).toBe("j6");
  });

  it("stops reminders immediately once reservation is no longer awaiting_payment", async () => {
    const issuedAt = new Date("2026-07-01T10:00:00.000Z");
    const { reservation } = await seedBankTransferHold({
      reference: "RES-2026-BTSTOP",
      issuedAt,
      expiresAt: new Date("2026-07-09T10:00:00.000Z"),
      startAt: new Date("2026-07-11T10:00:00.000Z"),
      endAt: new Date("2026-07-11T12:00:00.000Z"),
    });

    // Simulate mark-transfer-received
    const Reservation = await getReservationModel();
    await Reservation.updateOne(
      { _id: reservation._id },
      {
        $set: { status: "confirmed" },
        $unset: { awaitingPaymentExpiresAt: 1, awaitingPaymentMethod: 1 },
      },
    ).exec();

    const due = await findDueBankTransferReminders(new Date("2026-07-05T12:00:00.000Z"));
    expect(due).toEqual([]);

    const marked = await markBankTransferReminderSent(reservation._id, "j4");
    expect(marked).toBe(false);
  });

  it("expires bank_transfer hold, returns method, and frees the slot", async () => {
    const now = new Date("2026-07-10T10:00:00.000Z");
    const { spaceId } = await seedBankTransferHold({
      reference: "RES-2026-BTEXP",
      issuedAt: new Date("2026-07-01T10:00:00.000Z"),
      expiresAt: new Date("2026-07-09T10:00:00.000Z"),
      startAt: new Date("2026-07-20T10:00:00.000Z"),
      endAt: new Date("2026-07-20T12:00:00.000Z"),
    });

    const result = await expireAwaitingPaymentReservations(now);
    expect(result.expired).toHaveLength(1);
    expect(result.expired[0]?.awaitingPaymentMethod).toBe("bank_transfer");
    expect(result.expired[0]?.spaceName).toBe("Salle Virement");
    expect(result.expired[0]?.reference).toBe("RES-2026-BTEXP");

    const Reservation = await getReservationModel();
    const stored = await Reservation.findOne({ reference: "RES-2026-BTEXP" }).lean().exec();
    expect(stored?.status).toBe("cancelled");

    const { findOverlappingReservation } =
      await import("../../domains/reservation/availability.js");
    await expect(
      findOverlappingReservation(
        spaceId,
        new Date("2026-07-20T10:00:00.000Z"),
        new Date("2026-07-20T12:00:00.000Z"),
      ),
    ).resolves.toBeNull();
  });
});
