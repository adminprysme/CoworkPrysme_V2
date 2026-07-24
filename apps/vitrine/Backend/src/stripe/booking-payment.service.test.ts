import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signBookingPaymentAccessToken } from "@coworkprysme/shared/server";

const TOKEN_SECRET = "test-booking-payment-token-secret-32chars!!";

const {
  applyStripeCardPaymentMock,
  confirmReservationAfterCardPaymentMock,
  connectMongoMock,
  getInvoiceModelMock,
  getReservationModelMock,
  paymentIntentsCreateMock,
  paymentIntentsRetrieveMock,
  constructEventMock,
  reservationUpdateOneMock,
  sendEmailsAfterCardPaymentMock,
} = vi.hoisted(() => ({
  applyStripeCardPaymentMock: vi.fn(),
  confirmReservationAfterCardPaymentMock: vi.fn(),
  connectMongoMock: vi.fn().mockResolvedValue(undefined),
  getInvoiceModelMock: vi.fn(),
  getReservationModelMock: vi.fn(),
  paymentIntentsCreateMock: vi.fn(),
  paymentIntentsRetrieveMock: vi.fn(),
  constructEventMock: vi.fn(),
  reservationUpdateOneMock: vi.fn(),
  sendEmailsAfterCardPaymentMock: vi.fn(),
}));

vi.mock("@coworkprysme/db", () => ({
  applyStripeCardPayment: applyStripeCardPaymentMock,
  confirmReservationAfterCardPayment: confirmReservationAfterCardPaymentMock,
  connectMongo: connectMongoMock,
  getInvoiceModel: getInvoiceModelMock,
  getReservationModel: getReservationModelMock,
  InvoiceNotFoundError: class InvoiceNotFoundError extends Error {
    constructor() {
      super("Invoice not found");
      this.name = "InvoiceNotFoundError";
    }
  },
  StripePaymentAmountMismatchError: class StripePaymentAmountMismatchError extends Error {
    amountReceived: number;
    balanceDue: number;
    constructor(amountReceived: number, balanceDue: number) {
      super(`mismatch ${amountReceived} vs ${balanceDue}`);
      this.name = "StripePaymentAmountMismatchError";
      this.amountReceived = amountReceived;
      this.balanceDue = balanceDue;
    }
  },
}));

vi.mock("./stripe.config.js", () => ({
  loadStripeConfig: () => ({
    secretKey: "sk_test_mock",
    webhookSecret: "whsec_test_mock",
  }),
  createStripeClient: () => ({
    paymentIntents: {
      create: paymentIntentsCreateMock,
      retrieve: paymentIntentsRetrieveMock,
    },
    webhooks: { constructEvent: constructEventMock },
  }),
}));

import { BookingPaymentService } from "./booking-payment.service.js";
import { StripeWebhookController } from "./stripe-webhook.controller.js";
import type { BookingEmailsService } from "../booking/booking-emails.service.js";
import { StripePaymentAmountMismatchError } from "@coworkprysme/db";

const RESERVATION_ID = "507f1f77bcf86cd799439011";
const INVOICE_ID = "507f1f77bcf86cd799439012";

function mockInvoicePair(
  balanceDue = 4800,
  reservationOverrides: {
    status?: string;
    awaitingPaymentMethod?: string | undefined;
    awaitingPaymentExpiresAt?: Date;
    stripePaymentIntentId?: string;
  } = {},
) {
  reservationUpdateOneMock.mockReturnValue({
    exec: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  });

  getReservationModelMock.mockResolvedValue({
    findOne: vi.fn().mockReturnValue({
      lean: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          _id: RESERVATION_ID,
          reference: "RES-2026-00042",
          status: reservationOverrides.status ?? "awaiting_payment",
          awaitingPaymentMethod: reservationOverrides.awaitingPaymentMethod ?? "card",
          awaitingPaymentExpiresAt:
            reservationOverrides.awaitingPaymentExpiresAt ?? new Date(Date.now() + 60_000),
          stripePaymentIntentId: reservationOverrides.stripePaymentIntentId ?? "pi_test_reconcile",
        }),
      }),
    }),
    updateOne: reservationUpdateOneMock,
  });

  getInvoiceModelMock.mockResolvedValue({
    findOne: vi.fn().mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        _id: { toString: () => INVOICE_ID },
        reference: "PF-2026-00042",
        type: "proforma",
        status: "proforma",
        currency: "EUR",
        reservationId: { toString: () => RESERVATION_ID },
        totals: { paidTotal: 0, balanceDue, ttc: balanceDue, ht: 4000, vat: 800, discountTotal: 0 },
        issuedAt: new Date(),
        createdAt: new Date(),
      }),
    }),
  });
}

describe("Stripe booking payment", () => {
  let service: BookingPaymentService;
  let validToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BOOKING_PAYMENT_TOKEN_SECRET = TOKEN_SECRET;
    validToken = signBookingPaymentAccessToken({
      reservationReference: "RES-2026-00042",
      invoiceReference: "PF-2026-00042",
      expiresAt: new Date(Date.now() + 60_000),
      secret: TOKEN_SECRET,
    });
    sendEmailsAfterCardPaymentMock.mockResolvedValue(undefined);
    const bookingEmails = {
      sendEmailsAfterCardPayment: sendEmailsAfterCardPaymentMock,
    } as unknown as BookingEmailsService;
    const quotePayment = {
      handlePaymentIntentSucceeded: vi.fn().mockResolvedValue(false),
    };
    service = new BookingPaymentService(bookingEmails, quotePayment as never);
    // Expose for assertion in anti-booking / quote branch tests
    Object.defineProperty(service, "quotePayment", {
      value: quotePayment,
      writable: true,
    });
    mockInvoicePair(4800);
  });

  it("rejects webhook with invalid signature", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const controller = new StripeWebhookController(service);
    await expect(
      controller.handleWebhook({ rawBody: Buffer.from('{"id":"evt_1"}') } as never, "t=1,v1=bad"),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(applyStripeCardPaymentMock).not.toHaveBeenCalled();
  });

  it("applies payment_intent.succeeded, confirms reservation, and sends deferred emails", async () => {
    applyStripeCardPaymentMock.mockResolvedValue({
      applied: true,
      invoice: {
        type: "proforma",
        status: "paid",
        reference: "PF-2026-00042",
        totals: { paidTotal: 4800, balanceDue: 0 },
        reservationId: { toString: () => RESERVATION_ID },
      },
      payment: { method: "card" },
    });
    confirmReservationAfterCardPaymentMock.mockResolvedValue({
      transitioned: true,
      reservation: { status: "confirmed", reference: "RES-2026-00042" },
    });

    await service.handleWebhookEvent({
      id: "evt_succeeded",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_test_ok",
          amount: 4800,
          amount_received: 4800,
          metadata: {
            invoiceId: INVOICE_ID,
            invoiceReference: "PF-2026-00042",
            reservationId: RESERVATION_ID,
          },
        },
      },
    } as never);

    expect(applyStripeCardPaymentMock).toHaveBeenCalledWith({
      stripePaymentIntentId: "pi_test_ok",
      invoiceId: INVOICE_ID,
      amountReceived: 4800,
    });
    expect(confirmReservationAfterCardPaymentMock).toHaveBeenCalledWith({
      reservationId: RESERVATION_ID,
    });
    expect(sendEmailsAfterCardPaymentMock).toHaveBeenCalledWith({
      reservationId: RESERVATION_ID,
      invoiceReference: "PF-2026-00042",
    });
  });

  it("without metadata.quoteId follows exact booking path (point 5 anti-booking)", async () => {
    const quotePayment = (
      service as unknown as {
        quotePayment: { handlePaymentIntentSucceeded: ReturnType<typeof vi.fn> };
      }
    ).quotePayment;
    // Ensure quote handler returns false (no quoteId handled)
    quotePayment.handlePaymentIntentSucceeded.mockResolvedValue(false);

    applyStripeCardPaymentMock.mockResolvedValue({
      applied: true,
      invoice: {
        type: "proforma",
        status: "paid",
        reference: "PF-2026-00042",
        totals: { paidTotal: 4800, balanceDue: 0 },
        reservationId: { toString: () => RESERVATION_ID },
      },
      payment: { method: "card" },
    });
    confirmReservationAfterCardPaymentMock.mockResolvedValue({
      transitioned: true,
      reservation: { status: "confirmed", reference: "RES-2026-00042" },
    });

    await service.handleWebhookEvent({
      id: "evt_booking_no_quote",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_booking_only",
          amount: 4800,
          amount_received: 4800,
          metadata: {
            invoiceId: INVOICE_ID,
            reservationId: RESERVATION_ID,
            // deliberately NO quoteId
          },
        },
      },
    } as never);

    expect(quotePayment.handlePaymentIntentSucceeded).toHaveBeenCalled();
    expect(applyStripeCardPaymentMock).toHaveBeenCalledWith({
      stripePaymentIntentId: "pi_booking_only",
      invoiceId: INVOICE_ID,
      amountReceived: 4800,
    });
    expect(applyStripeCardPaymentMock.mock.calls[0]![0]).not.toHaveProperty("expectedAmountCents");
    expect(confirmReservationAfterCardPaymentMock).toHaveBeenCalledTimes(1);
    expect(sendEmailsAfterCardPaymentMock).toHaveBeenCalled();
  });

  it("with metadata.quoteId delegates to quote payment handler and skips booking path (point 4)", async () => {
    const quotePayment = (
      service as unknown as {
        quotePayment: { handlePaymentIntentSucceeded: ReturnType<typeof vi.fn> };
      }
    ).quotePayment;
    quotePayment.handlePaymentIntentSucceeded.mockResolvedValue(true);

    await service.handleWebhookEvent({
      id: "evt_quote_pay",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_quote",
          amount: 3600,
          amount_received: 3600,
          metadata: {
            invoiceId: INVOICE_ID,
            quoteId: "507f1f77bcf86cd799439099",
            paymentLinkId: "507f1f77bcf86cd799439098",
            reservationId: RESERVATION_ID,
          },
        },
      },
    } as never);

    expect(quotePayment.handlePaymentIntentSucceeded).toHaveBeenCalled();
    expect(applyStripeCardPaymentMock).not.toHaveBeenCalled();
    expect(confirmReservationAfterCardPaymentMock).not.toHaveBeenCalled();
    expect(sendEmailsAfterCardPaymentMock).not.toHaveBeenCalled();
  });

  it("does not send emails when payment_intent.succeeded is an idempotent replay", async () => {
    applyStripeCardPaymentMock.mockResolvedValue({
      applied: false,
      invoice: {
        type: "proforma",
        status: "paid",
        reference: "PF-2026-00042",
        totals: { paidTotal: 4800, balanceDue: 0 },
        reservationId: { toString: () => RESERVATION_ID },
      },
      payment: { method: "card" },
    });
    confirmReservationAfterCardPaymentMock.mockResolvedValue({
      transitioned: false,
      reservation: { status: "confirmed", reference: "RES-2026-00042" },
    });

    await service.handleWebhookEvent({
      id: "evt_replay",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_test_ok",
          amount: 4800,
          amount_received: 4800,
          metadata: {
            invoiceId: INVOICE_ID,
            reservationId: RESERVATION_ID,
          },
        },
      },
    } as never);

    expect(sendEmailsAfterCardPaymentMock).not.toHaveBeenCalled();
  });

  it("creates PaymentIntent amount from invoice.balanceDue, ignoring any client amount", async () => {
    paymentIntentsCreateMock.mockResolvedValue({
      id: "pi_created",
      client_secret: "pi_created_secret",
      status: "requires_payment_method",
    });
    paymentIntentsRetrieveMock.mockResolvedValue({
      id: "pi_created",
      client_secret: "pi_created_secret",
      status: "requires_payment_method",
    });

    const result = await service.createPaymentIntent({
      reservationReference: "RES-2026-00042",
      invoiceReference: "PF-2026-00042",
      paymentAccessToken: validToken,
      // @ts-expect-error — clients must not send amount; schema strips it, service never reads it
      amount: 1,
    });

    expect(paymentIntentsCreateMock).toHaveBeenCalledTimes(1);
    expect(paymentIntentsRetrieveMock).toHaveBeenCalledWith("pi_created");
    const [createArgs] = paymentIntentsCreateMock.mock.calls[0] as [
      { amount: number; currency: string },
      { idempotencyKey: string },
    ];
    expect(createArgs.amount).toBe(4800);
    expect(createArgs.amount).not.toBe(1);
    expect(result.amount).toBe(4800);
    expect(result.clientSecret).toBe("pi_created_secret");
    expect(reservationUpdateOneMock).toHaveBeenCalled();
  });

  it("refuses to return client_secret when PaymentIntent is already succeeded", async () => {
    paymentIntentsCreateMock.mockResolvedValue({
      id: "pi_already_paid",
      client_secret: "secret_should_not_leak",
      status: "requires_payment_method",
    });
    paymentIntentsRetrieveMock.mockResolvedValue({
      id: "pi_already_paid",
      client_secret: "secret_should_not_leak",
      status: "succeeded",
    });

    await expect(
      service.createPaymentIntent({
        reservationReference: "RES-2026-00042",
        invoiceReference: "PF-2026-00042",
        paymentAccessToken: validToken,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "ALREADY_PAID" }),
    });
    expect(reservationUpdateOneMock).not.toHaveBeenCalled();
  });

  it("rejects PaymentIntent creation without a valid paymentAccessToken", async () => {
    await expect(
      service.createPaymentIntent({
        reservationReference: "RES-2026-00042",
        invoiceReference: "PF-2026-00042",
        paymentAccessToken: "not-a-valid-token",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PAYMENT_TOKEN_INVALID" }),
    });
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled();
  });

  it("rejects PaymentIntent creation for a bank_transfer awaiting_payment hold", async () => {
    mockInvoicePair(2400, { awaitingPaymentMethod: "bank_transfer" });

    await expect(
      service.createPaymentIntent({
        reservationReference: "RES-2026-00042",
        invoiceReference: "PF-2026-00042",
        paymentAccessToken: validToken,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "INVOICE_NOT_PAYABLE" }),
    });
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled();
  });

  it("rejects PaymentIntent creation when reservation is already confirmed", async () => {
    mockInvoicePair(2400, { status: "confirmed", awaitingPaymentMethod: undefined });

    await expect(
      service.createPaymentIntent({
        reservationReference: "RES-2026-00042",
        invoiceReference: "PF-2026-00042",
        paymentAccessToken: validToken,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "INVOICE_NOT_PAYABLE" }),
    });
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled();
  });

  it("returns payment status when paymentAccessToken is valid", async () => {
    const status = await service.getPaymentStatus({
      reservationReference: "RES-2026-00042",
      invoiceReference: "PF-2026-00042",
      paymentAccessToken: validToken,
    });
    expect(status.paymentState).toBe("awaiting_payment");
    expect(status.balanceDue).toBe(4800);
  });

  it("rejects payment status with a mismatched paymentAccessToken", async () => {
    const otherToken = signBookingPaymentAccessToken({
      reservationReference: "RES-OTHER",
      invoiceReference: "PF-OTHER",
      expiresAt: new Date(Date.now() + 60_000),
      secret: TOKEN_SECRET,
    });
    await expect(
      service.getPaymentStatus({
        reservationReference: "RES-2026-00042",
        invoiceReference: "PF-2026-00042",
        paymentAccessToken: otherToken,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PAYMENT_TOKEN_INVALID" }),
    });
  });

  it("logs payment_intent.payment_failed without applying a payment, confirming, or emailing", async () => {
    await service.handleWebhookEvent({
      id: "evt_failed",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_fail",
          metadata: { invoiceReference: "PF-2026-00042" },
        },
      },
    } as never);

    expect(applyStripeCardPaymentMock).not.toHaveBeenCalled();
    expect(confirmReservationAfterCardPaymentMock).not.toHaveBeenCalled();
    expect(sendEmailsAfterCardPaymentMock).not.toHaveBeenCalled();
  });

  it("swallows amount mismatch on webhook without confirming or emailing", async () => {
    applyStripeCardPaymentMock.mockRejectedValue(new StripePaymentAmountMismatchError(4799, 4800));

    await expect(
      service.handleWebhookEvent({
        id: "evt_mismatch",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_mismatch",
            amount: 4799,
            amount_received: 4799,
            metadata: {
              invoiceId: INVOICE_ID,
              reservationId: RESERVATION_ID,
            },
          },
        },
      } as never),
    ).resolves.toBeUndefined();

    expect(confirmReservationAfterCardPaymentMock).not.toHaveBeenCalled();
    expect(sendEmailsAfterCardPaymentMock).not.toHaveBeenCalled();
  });

  it("reconcileFromStripe applies when Stripe PI is succeeded and local is still awaiting", async () => {
    paymentIntentsRetrieveMock.mockResolvedValue({
      id: "pi_test_reconcile",
      status: "succeeded",
      amount: 4800,
      amount_received: 4800,
      metadata: {
        invoiceId: INVOICE_ID,
        invoiceReference: "PF-2026-00042",
        reservationId: RESERVATION_ID,
      },
    });
    applyStripeCardPaymentMock.mockResolvedValue({
      applied: true,
      invoice: {
        type: "proforma",
        status: "paid",
        reference: "PF-2026-00042",
        totals: { paidTotal: 4800, balanceDue: 0 },
        reservationId: { toString: () => RESERVATION_ID },
      },
      payment: { method: "card" },
    });
    confirmReservationAfterCardPaymentMock.mockResolvedValue({
      transitioned: true,
      reservation: { status: "confirmed", reference: "RES-2026-00042" },
    });

    // After apply, status re-read sees paid + confirmed.
    let reservationReads = 0;
    let invoiceReads = 0;
    getReservationModelMock.mockResolvedValue({
      findOne: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockImplementation(async () => {
            reservationReads += 1;
            return {
              _id: RESERVATION_ID,
              reference: "RES-2026-00042",
              status: reservationReads >= 2 ? "confirmed" : "awaiting_payment",
              awaitingPaymentMethod: "card",
              awaitingPaymentExpiresAt: new Date(Date.now() + 60_000),
              stripePaymentIntentId: "pi_test_reconcile",
            };
          }),
        }),
      }),
      updateOne: reservationUpdateOneMock,
    });
    getInvoiceModelMock.mockResolvedValue({
      findOne: vi.fn().mockReturnValue({
        exec: vi.fn().mockImplementation(async () => {
          invoiceReads += 1;
          const paid = invoiceReads >= 2;
          return {
            _id: { toString: () => INVOICE_ID },
            reference: "PF-2026-00042",
            type: "proforma",
            status: paid ? "paid" : "proforma",
            currency: "EUR",
            reservationId: { toString: () => RESERVATION_ID },
            totals: {
              paidTotal: paid ? 4800 : 0,
              balanceDue: paid ? 0 : 4800,
              ttc: 4800,
              ht: 4000,
              vat: 800,
              discountTotal: 0,
            },
            issuedAt: new Date(),
            createdAt: new Date(),
          };
        }),
      }),
    });

    const result = await service.reconcileFromStripe({
      reservationReference: "RES-2026-00042",
      invoiceReference: "PF-2026-00042",
      paymentAccessToken: validToken,
    });

    expect(paymentIntentsRetrieveMock).toHaveBeenCalledWith("pi_test_reconcile");
    expect(applyStripeCardPaymentMock).toHaveBeenCalledWith({
      stripePaymentIntentId: "pi_test_reconcile",
      invoiceId: INVOICE_ID,
      amountReceived: 4800,
    });
    expect(confirmReservationAfterCardPaymentMock).toHaveBeenCalledWith({
      reservationId: RESERVATION_ID,
    });
    expect(sendEmailsAfterCardPaymentMock).toHaveBeenCalledWith({
      reservationId: RESERVATION_ID,
      invoiceReference: "PF-2026-00042",
    });
    expect(result.reservationStatus).toBe("confirmed");
    expect(result.paymentState).toBe("paid");
  });

  it("reconcileFromStripe does not apply when Stripe PI is still processing", async () => {
    paymentIntentsRetrieveMock.mockResolvedValue({
      id: "pi_test_reconcile",
      status: "processing",
      amount: 4800,
      amount_received: 0,
      metadata: { invoiceId: INVOICE_ID, reservationId: RESERVATION_ID },
    });

    const result = await service.reconcileFromStripe({
      reservationReference: "RES-2026-00042",
      invoiceReference: "PF-2026-00042",
      paymentAccessToken: validToken,
    });

    expect(applyStripeCardPaymentMock).not.toHaveBeenCalled();
    expect(result.reservationStatus).toBe("awaiting_payment");
    expect(result.paymentState).toBe("awaiting_payment");
  });

  it("reconcileFromStripe is a no-op when already confirmed and paid", async () => {
    mockInvoicePair(0, { status: "confirmed" });
    getInvoiceModelMock.mockResolvedValue({
      findOne: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          _id: { toString: () => INVOICE_ID },
          reference: "PF-2026-00042",
          type: "proforma",
          status: "paid",
          currency: "EUR",
          reservationId: { toString: () => RESERVATION_ID },
          totals: {
            paidTotal: 4800,
            balanceDue: 0,
            ttc: 4800,
            ht: 4000,
            vat: 800,
            discountTotal: 0,
          },
          issuedAt: new Date(),
          createdAt: new Date(),
        }),
      }),
    });

    const result = await service.reconcileFromStripe({
      reservationReference: "RES-2026-00042",
      invoiceReference: "PF-2026-00042",
      paymentAccessToken: validToken,
    });

    expect(paymentIntentsRetrieveMock).not.toHaveBeenCalled();
    expect(applyStripeCardPaymentMock).not.toHaveBeenCalled();
    expect(result.reservationStatus).toBe("confirmed");
    expect(result.paymentState).toBe("paid");
  });
});
