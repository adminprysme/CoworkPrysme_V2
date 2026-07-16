import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  applyStripeCardPaymentMock,
  connectMongoMock,
  getInvoiceModelMock,
  getReservationModelMock,
  paymentIntentsCreateMock,
  constructEventMock,
} = vi.hoisted(() => ({
  applyStripeCardPaymentMock: vi.fn(),
  connectMongoMock: vi.fn().mockResolvedValue(undefined),
  getInvoiceModelMock: vi.fn(),
  getReservationModelMock: vi.fn(),
  paymentIntentsCreateMock: vi.fn(),
  constructEventMock: vi.fn(),
}));

vi.mock("@coworkprysme/db", () => ({
  applyStripeCardPayment: applyStripeCardPaymentMock,
  connectMongo: connectMongoMock,
  getInvoiceModel: getInvoiceModelMock,
  getReservationModel: getReservationModelMock,
  InvoiceNotFoundError: class InvoiceNotFoundError extends Error {
    constructor() {
      super("Invoice not found");
      this.name = "InvoiceNotFoundError";
    }
  },
}));

vi.mock("./stripe.config.js", () => ({
  loadStripeConfig: () => ({
    secretKey: "sk_test_mock",
    webhookSecret: "whsec_test_mock",
  }),
  createStripeClient: () => ({
    paymentIntents: { create: paymentIntentsCreateMock },
    webhooks: { constructEvent: constructEventMock },
  }),
}));

import { BookingPaymentService } from "./booking-payment.service.js";
import { StripeWebhookController } from "./stripe-webhook.controller.js";

const RESERVATION_ID = "507f1f77bcf86cd799439011";
const INVOICE_ID = "507f1f77bcf86cd799439012";

function mockInvoicePair(balanceDue = 4800) {
  getReservationModelMock.mockResolvedValue({
    findOne: vi.fn().mockReturnValue({
      lean: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          _id: RESERVATION_ID,
          reference: "RES-2026-00042",
        }),
      }),
    }),
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

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BookingPaymentService();
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

  it("applies payment_intent.succeeded without changing invoice type (via applyStripeCardPayment)", async () => {
    applyStripeCardPaymentMock.mockResolvedValue({
      applied: true,
      invoice: { type: "proforma", status: "paid", totals: { paidTotal: 4800, balanceDue: 0 } },
      payment: { method: "card" },
    });

    await service.handleWebhookEvent({
      id: "evt_succeeded",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_test_ok",
          amount: 4800,
          amount_received: 4800,
          metadata: { invoiceId: INVOICE_ID, invoiceReference: "PF-2026-00042" },
        },
      },
    } as never);

    expect(applyStripeCardPaymentMock).toHaveBeenCalledWith({
      stripePaymentIntentId: "pi_test_ok",
      invoiceId: INVOICE_ID,
      amountReceived: 4800,
    });
  });

  it("creates PaymentIntent amount from invoice.balanceDue, ignoring any client amount", async () => {
    paymentIntentsCreateMock.mockResolvedValue({
      id: "pi_created",
      client_secret: "pi_created_secret",
    });

    const result = await service.createPaymentIntent({
      reservationReference: "RES-2026-00042",
      invoiceReference: "PF-2026-00042",
      // @ts-expect-error — clients must not send amount; schema strips it, service never reads it
      amount: 1,
    });

    expect(paymentIntentsCreateMock).toHaveBeenCalledTimes(1);
    const [createArgs] = paymentIntentsCreateMock.mock.calls[0] as [
      { amount: number; currency: string },
      { idempotencyKey: string },
    ];
    expect(createArgs.amount).toBe(4800);
    expect(createArgs.amount).not.toBe(1);
    expect(result.amount).toBe(4800);
    expect(result.clientSecret).toBe("pi_created_secret");
  });

  it("logs payment_intent.payment_failed without applying a payment", async () => {
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
  });
});
