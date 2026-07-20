import { beforeEach, describe, expect, it, vi } from "vitest";

const generatePdfForInvoiceReference = vi.fn();

vi.mock("@coworkprysme/invoice-pdf", () => ({
  InvoicePdfService: class {
    generatePdfForInvoiceReference = generatePdfForInvoiceReference;
  },
}));

vi.mock("@coworkprysme/db", () => ({
  connectMongo: vi.fn(),
  getBuildingModel: vi.fn(),
  getClientAccountModel: vi.fn(),
  getReservationModel: vi.fn(),
}));

import { InvoicePdfService } from "@coworkprysme/invoice-pdf";

import { BookingEmailsService } from "./booking-emails.service.js";
import type { MailService } from "../mail/mail.service.js";

describe("BookingEmailsService PDF attachments (Phase 2)", () => {
  let mail: { sendMail: ReturnType<typeof vi.fn> };
  let service: BookingEmailsService;

  const building = {
    name: "Cowork GERLAND",
    addressFull: "39 Rue Saint-Jean de Dieu, 69007 Lyon",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mail = { sendMail: vi.fn().mockResolvedValue(undefined) };
    generatePdfForInvoiceReference.mockResolvedValue({
      pdf: Buffer.from("%PDF-1.4 card-or-proforma"),
      model: { invoiceReference: "PF-2026-TEST" },
      html: "<html></html>",
    });
    service = new BookingEmailsService(mail as unknown as MailService, new InvoicePdfService());
  });

  it("attaches PDF on card confirmation email", async () => {
    await service.sendClientConfirmationEmails({
      clientEmail: "client@example.com",
      isNewAccount: false,
      reservationReference: "RES-2026-TEST",
      invoiceReference: "PF-2026-TEST",
      spaceName: "FOCUS",
      startAt: new Date("2026-07-20T10:00:00.000Z"),
      endAt: new Date("2026-07-20T11:00:00.000Z"),
      totalTTC: 2400,
      lines: [{ label: "FOCUS", qty: 1, totalTTC: 2400 }],
      vatBreakdown: [{ rate: 20, baseHT: 2000, vat: 400 }],
      building,
    });

    expect(generatePdfForInvoiceReference).toHaveBeenCalledWith("PF-2026-TEST");
    expect(mail.sendMail).toHaveBeenCalledTimes(1);
    const call = mail.sendMail.mock.calls[0]?.[0];
    expect(call.attachments).toEqual([
      {
        filename: "PF-2026-TEST.pdf",
        content: expect.any(Buffer),
        contentType: "application/pdf",
      },
    ]);
    expect(call.attachments[0].content.toString()).toContain("%PDF");
  });

  it("attaches PDF on bank-transfer instructions (proforma) email", async () => {
    await service.sendBankTransferInstructionsEmails({
      clientEmail: "client@example.com",
      isNewAccount: false,
      reservationReference: "RES-2026-BT",
      invoiceReference: "PF-2026-TEST",
      spaceName: "FOCUS",
      startAt: new Date("2026-07-20T10:00:00.000Z"),
      endAt: new Date("2026-07-20T11:00:00.000Z"),
      amountCents: 2400,
      expiresAt: new Date("2026-07-28T10:00:00.000Z"),
      rib: {
        iban: "FR7616958000019679122212512",
        bic: "QNTOFRP1XXX",
        accountHolder: "CG DEVELOPPEMENT",
      },
      transferLabel: "RES-2026-BT",
      building,
    });

    expect(generatePdfForInvoiceReference).toHaveBeenCalledWith("PF-2026-TEST");
    const call = mail.sendMail.mock.calls[0]?.[0];
    expect(call.attachments?.[0]?.filename).toBe("PF-2026-TEST.pdf");
  });

  it("does not attach PDF on bank-transfer reminder", async () => {
    await service.sendBankTransferReminderEmail({
      clientEmail: "client@example.com",
      reservationReference: "RES-2026-BT",
      invoiceReference: "PF-2026-TEST",
      spaceName: "FOCUS",
      startAt: new Date("2026-07-20T10:00:00.000Z"),
      endAt: new Date("2026-07-20T11:00:00.000Z"),
      amountCents: 2400,
      expiresAt: new Date("2026-07-28T10:00:00.000Z"),
      rib: {
        iban: "FR7616958000019679122212512",
        bic: "QNTOFRP1XXX",
        accountHolder: "CG DEVELOPPEMENT",
      },
      transferLabel: "RES-2026-BT",
      tier: "j2",
      building,
    });

    expect(generatePdfForInvoiceReference).not.toHaveBeenCalled();
    expect(mail.sendMail.mock.calls[0]?.[0].attachments).toBeUndefined();
  });
});
