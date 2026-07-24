import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  connectMongoMock,
  getInvoiceModelMock,
  getCardexModelMock,
  getClientAccountModelMock,
  getPaymentModelMock,
  getReservationModelMock,
  getQuoteModelMock,
  applyStaffPaymentMock,
} = vi.hoisted(() => ({
  connectMongoMock: vi.fn(),
  getInvoiceModelMock: vi.fn(),
  getCardexModelMock: vi.fn(),
  getClientAccountModelMock: vi.fn(),
  getPaymentModelMock: vi.fn(),
  getReservationModelMock: vi.fn(),
  getQuoteModelMock: vi.fn(),
  applyStaffPaymentMock: vi.fn(),
}));

vi.mock("@coworkprysme/db", () => ({
  connectMongo: connectMongoMock,
  getInvoiceModel: getInvoiceModelMock,
  getCardexModel: getCardexModelMock,
  getClientAccountModel: getClientAccountModelMock,
  getPaymentModel: getPaymentModelMock,
  getReservationModel: getReservationModelMock,
  getQuoteModel: getQuoteModelMock,
  applyStaffPayment: applyStaffPaymentMock,
  InvoiceNotFoundError: class InvoiceNotFoundError extends Error {
    constructor() {
      super("Invoice not found");
      this.name = "InvoiceNotFoundError";
    }
  },
  PaymentAmountExceedsBalanceError: class PaymentAmountExceedsBalanceError extends Error {
    amountReceived: number;
    balanceDue: number;
    constructor(amountReceived: number, balanceDue: number) {
      super("exceeds");
      this.name = "PaymentAmountExceedsBalanceError";
      this.amountReceived = amountReceived;
      this.balanceDue = balanceDue;
    }
  },
}));

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PaymentAmountExceedsBalanceError } from "@coworkprysme/db";

import { BillingInvoicesService } from "./billing-invoices.service.js";

function leanChain(result: unknown) {
  return {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(result),
  };
}

describe("BillingInvoicesService.list", () => {
  let service: BillingInvoicesService;
  const cardexId = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const invoiceId = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const invoicePdf = {
    generatePdfForInvoiceReference: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    connectMongoMock.mockResolvedValue(undefined);
    service = new BillingInvoicesService(invoicePdf as never);

    getCardexModelMock.mockResolvedValue({
      find: vi.fn((filter: Record<string, unknown>) => {
        if (filter.$or) {
          return leanChain([{ _id: cardexId }]);
        }
        return leanChain([
          {
            _id: cardexId,
            identity: { firstName: "Ada", lastName: "Lovelace" },
            company: { legalName: "Analytical Engines" },
          },
        ]);
      }),
    });

    getClientAccountModelMock.mockResolvedValue({
      find: vi.fn().mockReturnValue(leanChain([{ cardexId, email: "ada@example.com" }])),
    });

    getPaymentModelMock.mockResolvedValue({
      find: vi.fn().mockReturnValue(leanChain([])),
    });

    getReservationModelMock.mockResolvedValue({
      find: vi.fn().mockReturnValue(leanChain([])),
    });
  });

  it("filters by q against reference and cardex/email matches", async () => {
    const findMock = vi.fn().mockReturnValue(
      leanChain([
        {
          _id: invoiceId,
          reference: "PF-2026-00001",
          type: "proforma",
          status: "proforma",
          cardexId,
          totals: {
            ht: 10000,
            vat: 2000,
            ttc: 12000,
            discountTotal: 0,
            paidTotal: 0,
            balanceDue: 12000,
          },
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
        },
      ]),
    );
    getInvoiceModelMock.mockResolvedValue({
      find: findMock,
    });

    const result = await service.list({ q: "ada", page: 1, pageSize: 50 });
    expect(result.total).toBe(1);
    expect(result.summary).toEqual({
      invoiceCount: 1,
      balanceDueCents: 12000,
      paidTotalCents: 0,
    });
    expect(result.invoices[0]).toMatchObject({
      reference: "PF-2026-00001",
      clientLabel: "Ada Lovelace",
      companyLegalName: "Analytical Engines",
      companyName: "Analytical Engines",
      emails: ["ada@example.com"],
      paymentMethod: null,
    });
  });

  it("filters by status and issuedAt range", async () => {
    const findMock = vi.fn().mockReturnValue(leanChain([]));
    getInvoiceModelMock.mockResolvedValue({
      find: findMock,
    });

    await service.list({
      status: "paid",
      issuedFrom: "2026-07-01T00:00:00.000Z",
      issuedTo: "2026-07-31T23:59:59.000Z",
      page: 1,
      pageSize: 50,
    });

    expect(findMock).toHaveBeenCalledWith({
      $and: [
        { status: "paid" },
        {
          issuedAt: {
            $gte: new Date("2026-07-01T00:00:00.000Z"),
            $lte: new Date("2026-07-31T23:59:59.000Z"),
          },
        },
      ],
    });
  });

  it("filters by paymentMethod via Payment.method", async () => {
    getPaymentModelMock.mockImplementation(() => ({
      find: vi.fn((filter: Record<string, unknown>) => {
        if (filter.method === "card") {
          return leanChain([{ invoiceId }]);
        }
        return leanChain([{ invoiceId, method: "card" }]);
      }),
    }));

    const row = {
      _id: invoiceId,
      reference: "PF-2026-00002",
      type: "proforma",
      status: "partially_paid",
      cardexId,
      totals: {
        ht: 5000,
        vat: 1000,
        ttc: 6000,
        discountTotal: 0,
        paidTotal: 3000,
        balanceDue: 3000,
      },
      createdAt: new Date("2026-07-02T00:00:00.000Z"),
    };
    getInvoiceModelMock.mockResolvedValue({
      find: vi.fn().mockReturnValue(leanChain([row])),
    });

    const result = await service.list({ paymentMethod: "card", page: 1, pageSize: 50 });
    expect(result.invoices).toHaveLength(1);
    expect(result.invoices[0]!.paymentMethods).toEqual(["card"]);
    expect(result.invoices[0]!.paymentMethod).toBe("card");
    expect(result.summary.invoiceCount).toBe(1);
  });
});

describe("BillingInvoicesService.preparePdf", () => {
  const invoicePdf = {
    generatePdfForInvoiceReference: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    connectMongoMock.mockResolvedValue(undefined);
  });

  it("rejects invalid invoiceId", async () => {
    const service = new BillingInvoicesService(invoicePdf as never);
    await expect(service.preparePdf("not-an-id")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("404 when invoice missing", async () => {
    getInvoiceModelMock.mockResolvedValue({
      findById: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(null) }),
    });
    const service = new BillingInvoicesService(invoicePdf as never);
    await expect(service.preparePdf("cccccccccccccccccccccccc")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("reuses InvoicePdfService for existing invoice", async () => {
    invoicePdf.generatePdfForInvoiceReference.mockResolvedValue({
      pdf: Buffer.from("%PDF-1.4"),
    });
    getInvoiceModelMock.mockResolvedValue({
      findById: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          reference: "PF-2026-00006",
          type: "proforma",
        }),
      }),
    });
    const service = new BillingInvoicesService(invoicePdf as never);
    const prepared = await service.preparePdf("6a632b8d2a0ff8165b8cf9f5");
    expect(invoicePdf.generatePdfForInvoiceReference).toHaveBeenCalledWith("PF-2026-00006");
    expect(prepared.filename).toBe("proforma-PF-2026-00006.pdf");
    expect(prepared.pdf.toString("utf8")).toContain("%PDF");
  });
});

describe("BillingInvoicesService.markPaid", () => {
  const invoicePdf = { generatePdfForInvoiceReference: vi.fn() };
  const invoiceId = "6a632b8d2a0ff8165b8cf9f5";
  const staffId = "dddddddddddddddddddddddd";

  beforeEach(() => {
    vi.clearAllMocks();
    connectMongoMock.mockResolvedValue(undefined);
  });

  it("delegates to applyStaffPayment with method manual + staff id", async () => {
    applyStaffPaymentMock.mockResolvedValue({
      applied: true,
      invoice: {
        _id: invoiceId,
        reference: "PF-2026-00006",
        status: "paid",
        type: "proforma",
        totals: {
          ht: 25500,
          vat: 5100,
          ttc: 30600,
          discountTotal: 0,
          paidTotal: 30600,
          balanceDue: 0,
        },
        paidAt: new Date("2026-07-24T12:00:00.000Z"),
      },
      payment: {
        _id: "eeeeeeeeeeeeeeeeeeeeeeee",
        amount: 21420,
        method: "manual",
        receivedAt: new Date("2026-07-24T12:00:00.000Z"),
        reconciliation: { status: "matched", manualNote: "chèque" },
      },
    });

    const service = new BillingInvoicesService(invoicePdf as never);
    const result = await service.markPaid(
      invoiceId,
      { amountReceived: 21420, note: "chèque" },
      staffId,
    );

    expect(applyStaffPaymentMock).toHaveBeenCalledWith({
      invoiceId,
      amountReceived: 21420,
      method: "manual",
      markedByStaffProfileId: staffId,
      manualNote: "chèque",
    });
    expect(result.applied).toBe(true);
    expect(result.invoice.status).toBe("paid");
    expect(result.payment?.manualNote).toBe("chèque");
  });

  it("maps PaymentAmountExceedsBalanceError to 400", async () => {
    applyStaffPaymentMock.mockRejectedValue(new PaymentAmountExceedsBalanceError(99999, 100));
    const service = new BillingInvoicesService(invoicePdf as never);
    await expect(
      service.markPaid(invoiceId, { amountReceived: 99999 }, staffId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("BillingInvoicesService.getDetail", () => {
  const invoicePdf = { generatePdfForInvoiceReference: vi.fn() };
  const invoiceId = "6a632b8d2a0ff8165b8cf9f5";
  const cardexId = "6a632b8d2a0ff8165b8cf9f2";

  beforeEach(() => {
    vi.clearAllMocks();
    connectMongoMock.mockResolvedValue(undefined);
  });

  it("404 when invoice missing", async () => {
    getInvoiceModelMock.mockResolvedValue({
      findById: vi.fn().mockReturnValue(leanChain(null)),
    });
    const service = new BillingInvoicesService(invoicePdf as never);
    await expect(service.getDetail(invoiceId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("assembles quote, reservations, payments and cardex", async () => {
    getInvoiceModelMock.mockResolvedValue({
      findById: vi.fn().mockReturnValue(
        leanChain({
          _id: invoiceId,
          reference: "PF-2026-00006",
          type: "proforma",
          status: "partially_paid",
          cardexId,
          quoteId: "ffffffffffffffffffffffff",
          reservationId: "111111111111111111111111",
          lines: [
            {
              label: "FOCUS",
              kind: "space",
              qty: 1,
              totalHT: 25500,
              totalVAT: 5100,
              totalTTC: 30600,
            },
          ],
          totals: {
            ht: 25500,
            vat: 5100,
            ttc: 30600,
            discountTotal: 0,
            paidTotal: 9180,
            balanceDue: 21420,
          },
          issuedAt: new Date("2026-07-24T09:08:28.528Z"),
          createdAt: new Date("2026-07-24T09:08:29.730Z"),
        }),
      ),
    });
    getCardexModelMock.mockResolvedValue({
      findById: vi.fn().mockReturnValue(
        leanChain({
          identity: { firstName: "Alice", lastName: "Screenshot" },
          company: { legalName: "ACME SAS" },
        }),
      ),
    });
    getClientAccountModelMock.mockResolvedValue({
      find: vi.fn().mockReturnValue(leanChain([{ email: "alice@example.com" }])),
    });
    getPaymentModelMock.mockResolvedValue({
      find: vi.fn().mockReturnValue(
        leanChain([
          {
            _id: "222222222222222222222222",
            amount: 9180,
            method: "card",
            kind: "deposit",
            receivedAt: new Date("2026-07-24T09:10:00.000Z"),
            reconciliation: { status: "matched" },
          },
        ]),
      ),
    });
    getReservationModelMock.mockResolvedValue({
      find: vi.fn().mockReturnValue(
        leanChain([
          {
            _id: "111111111111111111111111",
            reference: "RES-1",
            status: "confirmed",
            startAt: new Date("2026-08-01T08:00:00.000Z"),
            endAt: new Date("2026-08-01T18:00:00.000Z"),
            spaceId: "333333333333333333333333",
            spaceSnapshot: { name: "FOCUS" },
          },
        ]),
      ),
    });
    getQuoteModelMock.mockResolvedValue({
      findById: vi.fn().mockReturnValue(
        leanChain({
          _id: "ffffffffffffffffffffffff",
          reference: "DEV-1",
          status: "accepted",
        }),
      ),
    });

    const service = new BillingInvoicesService(invoicePdf as never);
    const detail = await service.getDetail(invoiceId);
    expect(detail.reference).toBe("PF-2026-00006");
    expect(detail.companyLegalName).toBe("ACME SAS");
    expect(detail.quote?.reference).toBe("DEV-1");
    expect(detail.reservations[0]?.spaceName).toBe("FOCUS");
    expect(detail.payments[0]?.amount).toBe(9180);
  });
});
