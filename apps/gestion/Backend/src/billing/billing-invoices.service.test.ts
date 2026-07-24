import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  connectMongoMock,
  getInvoiceModelMock,
  getCardexModelMock,
  getClientAccountModelMock,
  getPaymentModelMock,
  getReservationModelMock,
} = vi.hoisted(() => ({
  connectMongoMock: vi.fn(),
  getInvoiceModelMock: vi.fn(),
  getCardexModelMock: vi.fn(),
  getClientAccountModelMock: vi.fn(),
  getPaymentModelMock: vi.fn(),
  getReservationModelMock: vi.fn(),
}));

vi.mock("@coworkprysme/db", () => ({
  connectMongo: connectMongoMock,
  getInvoiceModel: getInvoiceModelMock,
  getCardexModel: getCardexModelMock,
  getClientAccountModel: getClientAccountModelMock,
  getPaymentModel: getPaymentModelMock,
  getReservationModel: getReservationModelMock,
}));

import { BadRequestException, NotFoundException } from "@nestjs/common";

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
