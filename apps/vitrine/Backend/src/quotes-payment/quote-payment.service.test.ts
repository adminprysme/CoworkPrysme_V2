import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  redeemQuotePaymentLinkMock,
  applyStripeCardPaymentMock,
  confirmReservationAfterCardPaymentMock,
  consumeQuotePaymentLinkMock,
  getInvoiceModelMock,
  getQuoteModelMock,
  getQuotePaymentLinkModelMock,
  connectMongoMock,
} = vi.hoisted(() => ({
  redeemQuotePaymentLinkMock: vi.fn(),
  applyStripeCardPaymentMock: vi.fn(),
  confirmReservationAfterCardPaymentMock: vi.fn(),
  consumeQuotePaymentLinkMock: vi.fn(),
  getInvoiceModelMock: vi.fn(),
  getQuoteModelMock: vi.fn(),
  getQuotePaymentLinkModelMock: vi.fn(),
  connectMongoMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@coworkprysme/db", () => ({
  redeemQuotePaymentLink: redeemQuotePaymentLinkMock,
  applyStripeCardPayment: applyStripeCardPaymentMock,
  confirmReservationAfterCardPayment: confirmReservationAfterCardPaymentMock,
  consumeQuotePaymentLink: consumeQuotePaymentLinkMock,
  getInvoiceModel: getInvoiceModelMock,
  getQuoteModel: getQuoteModelMock,
  getQuotePaymentLinkModel: getQuotePaymentLinkModelMock,
  connectMongo: connectMongoMock,
  QuotePaymentLinkLookupError: class QuotePaymentLinkLookupError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "QuotePaymentLinkLookupError";
      this.code = code;
    }
  },
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

vi.mock("@coworkprysme/shared/server", () => ({
  parseVitrineApiEnv: () => ({
    QUOTE_PAYMENT_LINK_TOKEN_SECRET: "p".repeat(32),
  }),
}));

vi.mock("../stripe/stripe.config.js", () => ({
  loadStripeConfig: () => ({
    secretKey: "sk_test_mock",
    webhookSecret: "whsec_test_mock",
  }),
  createStripeClient: () => ({
    paymentIntents: {
      create: vi.fn().mockResolvedValue({
        id: "pi_quote",
        client_secret: "pi_quote_secret",
      }),
    },
  }),
}));

import { NotFoundException } from "@nestjs/common";
import { QuotePaymentLinkLookupError } from "@coworkprysme/db";

import { QuotePaymentService } from "./quote-payment.service.js";

const INVOICE_ID = "507f1f77bcf86cd799439012";
const QUOTE_ID = "507f1f77bcf86cd799439013";
const LINK_ID = "507f1f77bcf86cd799439014";
const RES_A = "507f1f77bcf86cd799439015";
const RES_B = "507f1f77bcf86cd799439016";
const TOKEN = "a".repeat(64);

describe("QuotePaymentService", () => {
  let service: QuotePaymentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new QuotePaymentService();
  });

  it("preview returns amount from redeem (point 3 — Elements path preview)", async () => {
    redeemQuotePaymentLinkMock.mockResolvedValue({
      _id: LINK_ID,
      invoiceId: INVOICE_ID,
      quoteId: QUOTE_ID,
      reservationIds: [RES_A],
      amountDueCentsSnapshot: 3600,
      expiresAt: new Date("2026-12-31T00:00:00.000Z"),
      status: "active",
    });
    getInvoiceModelMock.mockResolvedValue({
      findById: () => ({
        lean: () => ({
          exec: async () => ({
            _id: INVOICE_ID,
            reference: "PF-2026-00099",
            totals: { ttc: 12_000 },
          }),
        }),
      }),
    });
    getQuoteModelMock.mockResolvedValue({
      findById: () => ({
        lean: () => ({
          exec: async () => ({
            _id: QUOTE_ID,
            reference: "DEV-2026-00099",
            depositPercent: 30,
          }),
        }),
      }),
    });

    const preview = await service.preview({ token: TOKEN, invoiceId: INVOICE_ID });
    expect(preview.amountDueCents).toBe(3600);
    expect(preview.isDeposit).toBe(true);
    expect(preview.invoiceReference).toBe("PF-2026-00099");
  });

  it("cross-invoice redeem surfaces uniform 404 (point 7)", async () => {
    redeemQuotePaymentLinkMock.mockRejectedValue(
      new QuotePaymentLinkLookupError("PAYMENT_LINK_NOT_FOUND", "Lien de paiement introuvable."),
    );

    await expect(
      service.preview({ token: TOKEN, invoiceId: "507f1f77bcf86cd799439099" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("webhook with quoteId confirms ALL reservations and consumes link (point 4)", async () => {
    getQuotePaymentLinkModelMock.mockResolvedValue({
      findById: () => ({
        exec: async () => ({
          _id: LINK_ID,
          quoteId: QUOTE_ID,
          invoiceId: INVOICE_ID,
          reservationIds: [RES_A, RES_B],
          amountDueCentsSnapshot: 3600,
          status: "active",
        }),
      }),
    });
    applyStripeCardPaymentMock.mockResolvedValue({
      applied: true,
      invoice: { reference: "PF-2026-00099", status: "partially_paid" },
    });
    confirmReservationAfterCardPaymentMock.mockResolvedValue({ transitioned: true });
    consumeQuotePaymentLinkMock.mockResolvedValue({ consumed: true });

    const handled = await service.handlePaymentIntentSucceeded({
      id: "pi_quote",
      amount: 3600,
      amount_received: 3600,
      metadata: {
        quoteId: QUOTE_ID,
        invoiceId: INVOICE_ID,
        paymentLinkId: LINK_ID,
      },
    } as never);

    expect(handled).toBe(true);
    expect(applyStripeCardPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedAmountCents: 3600,
        amountReceived: 3600,
      }),
    );
    expect(confirmReservationAfterCardPaymentMock).toHaveBeenCalledTimes(2);
    expect(consumeQuotePaymentLinkMock).toHaveBeenCalledWith(
      expect.objectContaining({ paymentLinkId: LINK_ID, stripePaymentIntentId: "pi_quote" }),
    );
  });

  it("returns false when metadata has no quoteId (point 5 handoff)", async () => {
    const handled = await service.handlePaymentIntentSucceeded({
      id: "pi_booking",
      amount: 4800,
      amount_received: 4800,
      metadata: { invoiceId: INVOICE_ID },
    } as never);
    expect(handled).toBe(false);
    expect(applyStripeCardPaymentMock).not.toHaveBeenCalled();
  });
});
