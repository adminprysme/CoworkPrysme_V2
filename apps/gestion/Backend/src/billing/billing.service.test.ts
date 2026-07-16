import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  applyBankTransferPaymentMock,
  confirmReservationAfterPaymentMock,
  connectMongoMock,
  getInvoiceModelMock,
  getReservationModelMock,
  getClientAccountModelMock,
  getBuildingModelMock,
} = vi.hoisted(() => ({
  applyBankTransferPaymentMock: vi.fn(),
  confirmReservationAfterPaymentMock: vi.fn(),
  connectMongoMock: vi.fn(),
  getInvoiceModelMock: vi.fn(),
  getReservationModelMock: vi.fn(),
  getClientAccountModelMock: vi.fn(),
  getBuildingModelMock: vi.fn(),
}));

vi.mock("@coworkprysme/db", () => ({
  applyBankTransferPayment: applyBankTransferPaymentMock,
  confirmReservationAfterPayment: confirmReservationAfterPaymentMock,
  connectMongo: connectMongoMock,
  getInvoiceModel: getInvoiceModelMock,
  getReservationModel: getReservationModelMock,
  getClientAccountModel: getClientAccountModelMock,
  getBuildingModel: getBuildingModelMock,
}));

import { BillingService } from "./billing.service.js";
import type { MailService } from "../mail/mail.service.js";

describe("BillingService.markTransferReceivedByReference", () => {
  let service: BillingService;
  let mail: MailService;

  beforeEach(() => {
    vi.clearAllMocks();
    connectMongoMock.mockResolvedValue(undefined);
    mail = { sendMail: vi.fn() } as unknown as MailService;
    service = new BillingService(mail);

    const reservation = {
      _id: "res1",
      reference: "RES-2026-BT01",
      status: "awaiting_payment",
      awaitingPaymentMethod: "bank_transfer",
      clientAccountId: "cli1",
      buildingId: "bldg1",
      spaceSnapshot: { name: "Salle A" },
      startAt: new Date("2026-07-20T10:00:00.000Z"),
      endAt: new Date("2026-07-20T12:00:00.000Z"),
      pricing: { totalTTC: 12000 },
    };
    const invoice = {
      _id: "inv1",
      reference: "PF-BT01",
      reservationId: "res1",
      totals: { balanceDue: 12000 },
    };

    getReservationModelMock.mockResolvedValue({
      findOne: () => ({ exec: async () => reservation }),
      findById: () => ({ exec: async () => reservation }),
    });
    getInvoiceModelMock.mockResolvedValue({
      findOne: () => ({ exec: async () => invoice }),
      findById: () => ({ exec: async () => invoice }),
    });
    getClientAccountModelMock.mockResolvedValue({
      findById: () => ({
        select: () => ({
          lean: () => ({
            exec: async () => ({ email: "client@example.com" }),
          }),
        }),
      }),
    });
    getBuildingModelMock.mockResolvedValue({
      findById: () => ({
        lean: () => ({
          exec: async () => ({
            name: "Cowork GERLAND",
            accessCode: "BLDG-9911",
            address: {
              street: "39 Rue Saint-Jean de Dieu",
              zip: "69007",
              city: "Lyon",
              accessInfo: "Sonner à CoworkPrysme",
            },
            concierge: {
              url: "https://espaceclient.maconciergerie.eu/login",
              accessCode: "229",
            },
          }),
        }),
      }),
    });
    applyBankTransferPaymentMock.mockResolvedValue({
      applied: true,
      invoice: { ...invoice, reference: "PF-BT01" },
      payment: { _id: "pay1" },
    });
    confirmReservationAfterPaymentMock.mockResolvedValue({
      transitioned: true,
      reservation: { ...reservation, status: "confirmed" },
    });
  });

  it("applies transfer payment, confirms reservation, and emails access plan", async () => {
    const result = await service.markTransferReceivedByReference("RES-2026-BT01", "staff1");

    expect(applyBankTransferPaymentMock).toHaveBeenCalledWith({
      invoiceId: "inv1",
      amountReceived: 12000,
      markedByStaffProfileId: "staff1",
    });
    expect(confirmReservationAfterPaymentMock).toHaveBeenCalledWith({
      reservationId: "res1",
      reason: "bank_transfer_received",
    });
    expect(mail.sendMail).toHaveBeenCalled();
    const mailCall = (mail.sendMail as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      html: string;
    };
    expect(mailCall.html).toContain("Code conciergerie");
    expect(mailCall.html).toContain("229");
    expect(mailCall.html).toContain("BLDG-9911");
    expect(mailCall.html).toContain("Sonner à CoworkPrysme");
    expect(result).toMatchObject({
      applied: true,
      transitioned: true,
      reservationStatus: "confirmed",
      amountReceivedCents: 12000,
      paymentId: "pay1",
    });
  });
});
