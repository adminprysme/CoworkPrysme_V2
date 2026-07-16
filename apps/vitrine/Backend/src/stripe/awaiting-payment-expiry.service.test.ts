import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  expireAwaitingPaymentReservationsMock,
  findDueBankTransferRemindersMock,
  markBankTransferReminderSentMock,
  getClientAccountModelMock,
  connectMongoMock,
  paymentIntentsRetrieveMock,
  paymentIntentsCancelMock,
  loadBankTransferRibConfigMock,
} = vi.hoisted(() => ({
  expireAwaitingPaymentReservationsMock: vi.fn(),
  findDueBankTransferRemindersMock: vi.fn(),
  markBankTransferReminderSentMock: vi.fn(),
  getClientAccountModelMock: vi.fn(),
  connectMongoMock: vi.fn(),
  paymentIntentsRetrieveMock: vi.fn(),
  paymentIntentsCancelMock: vi.fn(),
  loadBankTransferRibConfigMock: vi.fn(),
}));

vi.mock("@coworkprysme/db", () => ({
  expireAwaitingPaymentReservations: expireAwaitingPaymentReservationsMock,
  findDueBankTransferReminders: findDueBankTransferRemindersMock,
  markBankTransferReminderSent: markBankTransferReminderSentMock,
  getClientAccountModel: getClientAccountModelMock,
  connectMongo: connectMongoMock,
}));

vi.mock("../booking/bank-transfer.config.js", () => ({
  loadBankTransferRibConfig: loadBankTransferRibConfigMock,
}));

import { AwaitingPaymentExpiryService } from "./awaiting-payment-expiry.service.js";
import type { BookingEmailsService } from "../booking/booking-emails.service.js";
import type { BookingPaymentService } from "./booking-payment.service.js";

describe("AwaitingPaymentExpiryService — Stripe PaymentIntent cancellation", () => {
  let service: AwaitingPaymentExpiryService;
  let bookingPayment: BookingPaymentService;
  let bookingEmails: BookingEmailsService;

  beforeEach(() => {
    vi.clearAllMocks();
    connectMongoMock.mockResolvedValue(undefined);
    findDueBankTransferRemindersMock.mockResolvedValue([]);
    loadBankTransferRibConfigMock.mockReturnValue(null);
    bookingPayment = {
      getStripe: vi.fn().mockReturnValue({
        paymentIntents: {
          retrieve: paymentIntentsRetrieveMock,
          cancel: paymentIntentsCancelMock,
        },
      }),
    } as unknown as BookingPaymentService;
    bookingEmails = {
      resolveBuildingAccess: vi.fn(),
      sendBankTransferReminderEmail: vi.fn(),
      sendBankTransferExpiredEmail: vi.fn(),
    } as unknown as BookingEmailsService;
    service = new AwaitingPaymentExpiryService(bookingPayment, bookingEmails);
  });

  it("cancels the Stripe PaymentIntent when an awaiting_payment hold expires", async () => {
    expireAwaitingPaymentReservationsMock.mockResolvedValue({
      expired: [
        {
          reservationId: "res1",
          reference: "RES-2026-00099",
          awaitingPaymentMethod: "card",
          stripePaymentIntentId: "pi_to_cancel",
        },
      ],
    });
    paymentIntentsRetrieveMock.mockResolvedValue({
      id: "pi_to_cancel",
      status: "requires_payment_method",
    });
    paymentIntentsCancelMock.mockResolvedValue({
      id: "pi_to_cancel",
      status: "canceled",
    });

    const result = await service.sweep(new Date("2026-07-01T12:00:00.000Z"));

    expect(expireAwaitingPaymentReservationsMock).toHaveBeenCalled();
    expect(paymentIntentsRetrieveMock).toHaveBeenCalledWith("pi_to_cancel");
    expect(paymentIntentsCancelMock).toHaveBeenCalledWith("pi_to_cancel");
    expect(result.expiredCount).toBe(1);
    expect(result.paymentIntentsCancelled).toEqual([
      { paymentIntentId: "pi_to_cancel", cancelled: true, status: "canceled" },
    ]);
  });

  it("does not call cancel when PaymentIntent already succeeded", async () => {
    expireAwaitingPaymentReservationsMock.mockResolvedValue({
      expired: [
        {
          reservationId: "res2",
          reference: "RES-2026-00100",
          awaitingPaymentMethod: "card",
          stripePaymentIntentId: "pi_already_paid",
        },
      ],
    });
    paymentIntentsRetrieveMock.mockResolvedValue({
      id: "pi_already_paid",
      status: "succeeded",
    });

    const result = await service.sweep();

    expect(paymentIntentsCancelMock).not.toHaveBeenCalled();
    expect(result.paymentIntentsCancelled[0]).toMatchObject({
      paymentIntentId: "pi_already_paid",
      cancelled: false,
      reason: "already_succeeded",
    });
  });

  it("skips Stripe when expired reservation has no PaymentIntent id", async () => {
    expireAwaitingPaymentReservationsMock.mockResolvedValue({
      expired: [
        {
          reservationId: "res3",
          reference: "RES-2026-00101",
          awaitingPaymentMethod: "card",
        },
      ],
    });

    const result = await service.sweep();

    expect(paymentIntentsRetrieveMock).not.toHaveBeenCalled();
    expect(paymentIntentsCancelMock).not.toHaveBeenCalled();
    expect(result.expiredCount).toBe(1);
    expect(result.paymentIntentsCancelled).toEqual([]);
  });

  it("sends bank_transfer expiry email and does not cancel Stripe", async () => {
    getClientAccountModelMock.mockResolvedValue({
      findById: () => ({
        select: () => ({
          lean: () => ({
            exec: async () => ({ email: "client@example.com" }),
          }),
        }),
      }),
    });
    expireAwaitingPaymentReservationsMock.mockResolvedValue({
      expired: [
        {
          reservationId: "res4",
          reference: "RES-2026-00102",
          awaitingPaymentMethod: "bank_transfer",
          clientAccountId: "cli1",
          spaceName: "Salle B",
        },
      ],
    });

    const result = await service.sweep();

    expect(bookingEmails.sendBankTransferExpiredEmail).toHaveBeenCalledWith({
      clientEmail: "client@example.com",
      reservationReference: "RES-2026-00102",
      spaceName: "Salle B",
    });
    expect(paymentIntentsCancelMock).not.toHaveBeenCalled();
    expect(result.expiredCount).toBe(1);
  });

  it("sends due bank_transfer reminders when mark succeeds", async () => {
    loadBankTransferRibConfigMock.mockReturnValue({
      iban: "FR76",
      bic: "QNTO",
      accountHolder: "Cowork",
    });
    findDueBankTransferRemindersMock.mockResolvedValue([
      {
        reservationId: "res5",
        reference: "RES-2026-00103",
        clientAccountId: "cli2",
        buildingId: "b1",
        invoiceId: "inv1",
        invoiceReference: "PF-1",
        amountCents: 12000,
        issuedAt: new Date("2026-07-01T10:00:00.000Z"),
        expiresAt: new Date("2026-07-09T10:00:00.000Z"),
        tier: "j2",
        spaceName: "Salle C",
        startAt: new Date("2026-07-20T10:00:00.000Z"),
        endAt: new Date("2026-07-20T12:00:00.000Z"),
      },
    ]);
    markBankTransferReminderSentMock.mockResolvedValue(true);
    getClientAccountModelMock.mockResolvedValue({
      findById: () => ({
        select: () => ({
          lean: () => ({
            exec: async () => ({ email: "remind@example.com" }),
          }),
        }),
      }),
    });
    (bookingEmails.resolveBuildingAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Building",
    });
    expireAwaitingPaymentReservationsMock.mockResolvedValue({ expired: [] });

    const result = await service.sweep(new Date("2026-07-03T12:00:00.000Z"));

    expect(markBankTransferReminderSentMock).toHaveBeenCalledWith("res5", "j2");
    expect(bookingEmails.sendBankTransferReminderEmail).toHaveBeenCalled();
    expect(result.remindersSent).toBe(1);
  });

  it("stops reminders immediately when mark fails (already received/confirmed)", async () => {
    loadBankTransferRibConfigMock.mockReturnValue({
      iban: "FR76",
      bic: "QNTO",
      accountHolder: "Cowork",
    });
    findDueBankTransferRemindersMock.mockResolvedValue([
      {
        reservationId: "res6",
        reference: "RES-2026-00104",
        clientAccountId: "cli3",
        buildingId: "b1",
        invoiceId: "inv2",
        invoiceReference: "PF-2",
        amountCents: 9000,
        issuedAt: new Date("2026-07-01T10:00:00.000Z"),
        expiresAt: new Date("2026-07-09T10:00:00.000Z"),
        tier: "j4",
        spaceName: "Salle D",
        startAt: new Date("2026-07-20T10:00:00.000Z"),
        endAt: new Date("2026-07-20T12:00:00.000Z"),
      },
    ]);
    // mark-received already moved status away from awaiting_payment
    markBankTransferReminderSentMock.mockResolvedValue(false);
    expireAwaitingPaymentReservationsMock.mockResolvedValue({ expired: [] });

    const result = await service.sweep(new Date("2026-07-05T12:00:00.000Z"));

    expect(bookingEmails.sendBankTransferReminderEmail).not.toHaveBeenCalled();
    expect(result.remindersSent).toBe(0);
  });
});
