import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { connectMongo, getCoworkDb } from "../../connection.js";
import {
  applyStripeCardPayment,
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
  const ttc = overrides?.ttc ?? 6000;
  const paidTotal = overrides?.paidTotal ?? 0;
  const balanceDue = overrides?.balanceDue ?? ttc - paidTotal;

  const invoice = await Invoice.create({
    reference: `PF-TEST-${new Types.ObjectId().toString().slice(-8)}`,
    currency: "EUR",
    type: "proforma",
    cardexId: new Types.ObjectId(),
    reservationId: new Types.ObjectId(),
    lines: [
      {
        label: "Salle A",
        kind: "space",
        qty: 1,
        unitPriceHT: 5000,
        vatRate: 20,
        discount: 0,
        totalHT: 5000,
        totalVAT: 1000,
        totalTTC: ttc,
      },
    ],
    vatBreakdown: [{ rate: 20, baseHT: 5000, vat: 1000 }],
    totals: {
      ht: 5000,
      vat: 1000,
      ttc,
      discountTotal: 0,
      paidTotal,
      balanceDue,
    },
    paymentSituation: "immediate",
    status: overrides?.status ?? "proforma",
    issuedAt: new Date(),
  });

  return invoice;
}

describe("applyStripeCardPayment", () => {
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

  it("updates paidTotal/status, creates matched card payment, leaves type as proforma", async () => {
    const invoice = await seedProformaInvoice();
    const pi = "pi_test_succeeded_001";

    const result = await applyStripeCardPayment({
      stripePaymentIntentId: pi,
      invoiceId: invoice._id,
      amountReceived: 6000,
    });

    expect(result.applied).toBe(true);
    expect(result.invoice.type).toBe("proforma");
    expect(result.invoice.status).toBe("paid");
    expect(result.invoice.totals.paidTotal).toBe(6000);
    expect(result.invoice.totals.balanceDue).toBe(0);
    expect(result.payment.method).toBe("card");
    expect(result.payment.reconciliation.status).toBe("matched");
    expect(result.payment.reconciliation.stripePaymentIntentId).toBe(pi);
    expect(result.payment.amount).toBe(6000);

    const Payment = await getPaymentModel();
    expect(await Payment.countDocuments({ invoiceId: invoice._id })).toBe(1);
  });

  it("is idempotent on double webhook for the same PaymentIntent", async () => {
    const invoice = await seedProformaInvoice();
    const pi = "pi_test_idempotent_001";

    const first = await applyStripeCardPayment({
      stripePaymentIntentId: pi,
      invoiceId: invoice._id,
      amountReceived: 6000,
    });
    const second = await applyStripeCardPayment({
      stripePaymentIntentId: pi,
      invoiceId: invoice._id,
      amountReceived: 6000,
    });

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.invoice.totals.paidTotal).toBe(6000);
    expect(second.invoice.type).toBe("proforma");

    const Payment = await getPaymentModel();
    expect(await Payment.countDocuments({ invoiceId: invoice._id })).toBe(1);
  });

  it("marks partially_paid when amount does not cover balanceDue", async () => {
    const invoice = await seedProformaInvoice({ ttc: 10_000 });

    const result = await applyStripeCardPayment({
      stripePaymentIntentId: "pi_test_partial_001",
      invoiceId: invoice._id,
      amountReceived: 4000,
    });

    expect(result.invoice.type).toBe("proforma");
    expect(result.invoice.status).toBe("partially_paid");
    expect(result.invoice.totals.paidTotal).toBe(4000);
    expect(result.invoice.totals.balanceDue).toBe(6000);
  });
});
