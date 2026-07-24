import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { connectMongo, getCoworkDb } from "../../connection.js";
import { PaymentAmountExceedsBalanceError } from "../../lib/errors.js";
import {
  applyBankTransferPayment,
  applyStaffPayment,
  getInvoiceModel,
  getPaymentModel,
  registerInvoiceModel,
  registerPaymentModel,
} from "../../domains/billing/index.js";
import { registerCardexModel } from "../../domains/client/index.js";
import {
  clearCoworkCollections,
  configureIntegrationEnv,
  startIntegrationMongo,
  stopIntegrationMongo,
} from "./setup.js";

async function seedProformaInvoice(overrides?: {
  paidTotal?: number;
  balanceDue?: number;
  ttc?: number;
  status?: "proforma" | "partially_paid" | "paid";
}) {
  const Invoice = await getInvoiceModel();
  const ttc = overrides?.ttc ?? 10_000;
  const paidTotal = overrides?.paidTotal ?? 0;
  const balanceDue = overrides?.balanceDue ?? ttc - paidTotal;

  return Invoice.create({
    reference: `PF-STAFF-${new Types.ObjectId().toString().slice(-8)}`,
    currency: "EUR",
    type: "proforma",
    cardexId: new Types.ObjectId(),
    reservationId: new Types.ObjectId(),
    lines: [
      {
        label: "Salle A",
        kind: "space",
        qty: 1,
        unitPriceHT: 8334,
        vatRate: 20,
        discount: 0,
        totalHT: 8334,
        totalVAT: 1666,
        totalTTC: ttc,
      },
    ],
    vatBreakdown: [{ rate: 20, baseHT: 8334, vat: 1666 }],
    totals: {
      ht: 8334,
      vat: 1666,
      ttc,
      discountTotal: 0,
      paidTotal,
      balanceDue,
    },
    paymentSituation: "immediate",
    status: overrides?.status ?? "proforma",
    issuedAt: new Date(),
  });
}

describe("applyStaffPayment / applyBankTransferPayment", () => {
  beforeAll(async () => {
    const uri = await startIntegrationMongo();
    await configureIntegrationEnv(uri);
    await connectMongo();
    const connection = await getCoworkDb();
    registerInvoiceModel(connection);
    registerPaymentModel(connection);
    registerCardexModel(connection);
  }, 120_000);

  afterEach(async () => {
    await clearCoworkCollections();
  });

  afterAll(async () => {
    await stopIntegrationMongo();
  });

  it("manual partial then full: paidTotal/balanceDue/status + staff id + note", async () => {
    const invoice = await seedProformaInvoice({ ttc: 10_000 });
    const staffId = new Types.ObjectId();

    const partial = await applyStaffPayment({
      invoiceId: invoice._id,
      amountReceived: 4000,
      method: "manual",
      markedByStaffProfileId: staffId,
      manualNote: "Acompte chèque",
    });

    expect(partial.applied).toBe(true);
    expect(partial.invoice.type).toBe("proforma");
    expect(partial.invoice.status).toBe("partially_paid");
    expect(partial.invoice.totals.paidTotal).toBe(4000);
    expect(partial.invoice.totals.balanceDue).toBe(6000);
    expect(partial.payment?.method).toBe("manual");
    expect(String(partial.payment?.markedByStaffProfileId)).toBe(String(staffId));
    expect(partial.payment?.reconciliation.manualNote).toBe("Acompte chèque");

    const full = await applyStaffPayment({
      invoiceId: invoice._id,
      amountReceived: 6000,
      method: "manual",
      markedByStaffProfileId: staffId,
    });

    expect(full.applied).toBe(true);
    expect(full.invoice.status).toBe("paid");
    expect(full.invoice.totals.paidTotal).toBe(10_000);
    expect(full.invoice.totals.balanceDue).toBe(0);
    expect(full.invoice.type).toBe("proforma");
    expect(full.invoice.paidAt).toBeTruthy();
  });

  it("rejects amount above remaining balanceDue", async () => {
    const invoice = await seedProformaInvoice({ ttc: 5000 });
    await expect(
      applyStaffPayment({
        invoiceId: invoice._id,
        amountReceived: 5001,
        method: "manual",
      }),
    ).rejects.toBeInstanceOf(PaymentAmountExceedsBalanceError);

    const Payment = await getPaymentModel();
    expect(await Payment.countDocuments({ invoiceId: invoice._id })).toBe(0);
  });

  it("bank transfer persists markedByStaffProfileId", async () => {
    const invoice = await seedProformaInvoice({ ttc: 8000 });
    const staffId = new Types.ObjectId();

    const result = await applyBankTransferPayment({
      invoiceId: invoice._id,
      amountReceived: 8000,
      markedByStaffProfileId: staffId,
    });

    expect(result.applied).toBe(true);
    expect(result.payment?.method).toBe("transfer");
    expect(String(result.payment?.markedByStaffProfileId)).toBe(String(staffId));
    expect(result.invoice.status).toBe("paid");
  });
});
