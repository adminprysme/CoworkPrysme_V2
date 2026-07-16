import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  expireAwaitingPaymentReservationsMock,
  paymentIntentsRetrieveMock,
  paymentIntentsCancelMock,
} = vi.hoisted(() => ({
  expireAwaitingPaymentReservationsMock: vi.fn(),
  paymentIntentsRetrieveMock: vi.fn(),
  paymentIntentsCancelMock: vi.fn(),
}));

vi.mock("@coworkprysme/db", () => ({
  expireAwaitingPaymentReservations: expireAwaitingPaymentReservationsMock,
}));

import { AwaitingPaymentExpiryService } from "./awaiting-payment-expiry.service.js";
import type { BookingPaymentService } from "./booking-payment.service.js";

describe("AwaitingPaymentExpiryService — Stripe PaymentIntent cancellation", () => {
  let service: AwaitingPaymentExpiryService;
  let bookingPayment: BookingPaymentService;

  beforeEach(() => {
    vi.clearAllMocks();
    bookingPayment = {
      getStripe: vi.fn().mockReturnValue({
        paymentIntents: {
          retrieve: paymentIntentsRetrieveMock,
          cancel: paymentIntentsCancelMock,
        },
      }),
    } as unknown as BookingPaymentService;
    service = new AwaitingPaymentExpiryService(bookingPayment);
  });

  it("cancels the Stripe PaymentIntent when an awaiting_payment hold expires", async () => {
    expireAwaitingPaymentReservationsMock.mockResolvedValue({
      expired: [
        {
          reservationId: "res1",
          reference: "RES-2026-00099",
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
      expired: [{ reservationId: "res3", reference: "RES-2026-00101" }],
    });

    const result = await service.sweep();

    expect(paymentIntentsRetrieveMock).not.toHaveBeenCalled();
    expect(paymentIntentsCancelMock).not.toHaveBeenCalled();
    expect(result.expiredCount).toBe(1);
    expect(result.paymentIntentsCancelled).toEqual([]);
  });
});
