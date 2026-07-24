import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { connectMongo } from "../../connection.js";
import {
  consumeQuotePaymentLink,
  createQuotePaymentLink,
  getQuotePaymentLinkModel,
  redeemQuotePaymentLink,
  registerQuotePaymentLinkModel,
  QuotePaymentLinkLookupError,
} from "../../domains/billing/index.js";
import {
  clearCoworkCollections,
  configureIntegrationEnv,
  startIntegrationMongo,
  stopIntegrationMongo,
} from "./setup.js";

const SECRET = "quote-payment-link-integration-secret-32chars!!";

describe("quotePaymentLinks redeem / expiry / consume (points 1, 7, 8)", () => {
  const quoteId = new Types.ObjectId();
  const invoiceIdA = new Types.ObjectId();
  const invoiceIdB = new Types.ObjectId();
  const cardexId = new Types.ObjectId();
  const reservationIds = [new Types.ObjectId()];

  beforeAll(async () => {
    const uri = await startIntegrationMongo();
    await configureIntegrationEnv(uri);
    await connectMongo();
    const { getCoworkDb } = await import("../../connection.js");
    const connection = await getCoworkDb();
    registerQuotePaymentLinkModel(connection);
  }, 60_000);

  afterAll(async () => {
    await stopIntegrationMongo();
  });

  beforeEach(async () => {
    await clearCoworkCollections();
  });

  it("creates link with tokenHash, membership fields, expiresAt, amount snapshot", async () => {
    const validUntil = new Date("2026-12-31T23:59:59.000Z");
    const created = await createQuotePaymentLink({
      quote: {
        _id: quoteId,
        depositPercent: 30,
        depositAmountTTC: 3600,
        totals: { ttc: 12_000 },
        validUntil,
        cardexId,
      },
      invoiceId: invoiceIdA,
      reservationIds,
      cardexId,
      tokenSecret: SECRET,
    });

    expect(created.amountDueCents).toBe(3600);
    expect(created.expiresAt.toISOString()).toBe(validUntil.toISOString());
    expect(created.rawToken).toMatch(/^[a-f0-9]{64}$/);

    const QuotePaymentLink = await getQuotePaymentLinkModel();
    const stored = await QuotePaymentLink.findById(created.paymentLinkId).lean().exec();
    expect(stored).toMatchObject({
      status: "active",
      amountDueCentsSnapshot: 3600,
    });
    expect(String(stored?.quoteId)).toBe(String(quoteId));
    expect(String(stored?.invoiceId)).toBe(String(invoiceIdA));
    expect(stored?.tokenHash).not.toBe(created.rawToken);
    expect(stored?.expiresAt.toISOString()).toBe(validUntil.toISOString());
  });

  it("rejects cross-invoice redeem with uniform PAYMENT_LINK_NOT_FOUND (point 7)", async () => {
    const created = await createQuotePaymentLink({
      quote: {
        _id: quoteId,
        depositPercent: 0,
        totals: { ttc: 4800 },
        validUntil: new Date("2026-12-31T00:00:00.000Z"),
        cardexId,
      },
      invoiceId: invoiceIdA,
      reservationIds,
      cardexId,
      tokenSecret: SECRET,
    });

    await expect(
      redeemQuotePaymentLink({
        rawToken: created.rawToken,
        invoiceId: invoiceIdB,
        tokenSecret: SECRET,
      }),
    ).rejects.toMatchObject({
      name: "QuotePaymentLinkLookupError",
      code: "PAYMENT_LINK_NOT_FOUND",
    });

    await expect(
      redeemQuotePaymentLink({
        rawToken: "a".repeat(64),
        invoiceId: invoiceIdA,
        tokenSecret: SECRET,
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_LINK_NOT_FOUND" });
  });

  it("rejects expired link aligned to validUntil (point 8)", async () => {
    const created = await createQuotePaymentLink({
      quote: {
        _id: quoteId,
        totals: { ttc: 4800 },
        validUntil: new Date("2026-01-01T00:00:00.000Z"),
        cardexId,
      },
      invoiceId: invoiceIdA,
      reservationIds,
      cardexId,
      tokenSecret: SECRET,
    });

    await expect(
      redeemQuotePaymentLink({
        rawToken: created.rawToken,
        invoiceId: invoiceIdA,
        tokenSecret: SECRET,
        now: new Date("2026-01-02T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_LINK_EXPIRED" });
  });

  it("rejects second redeem after consume (point 8)", async () => {
    const created = await createQuotePaymentLink({
      quote: {
        _id: quoteId,
        totals: { ttc: 4800 },
        validUntil: new Date("2026-12-31T00:00:00.000Z"),
        cardexId,
      },
      invoiceId: invoiceIdA,
      reservationIds,
      cardexId,
      tokenSecret: SECRET,
    });

    await consumeQuotePaymentLink({
      paymentLinkId: created.paymentLinkId,
      stripePaymentIntentId: "pi_test_1",
    });

    await expect(
      redeemQuotePaymentLink({
        rawToken: created.rawToken,
        invoiceId: invoiceIdA,
        tokenSecret: SECRET,
      }),
    ).rejects.toBeInstanceOf(QuotePaymentLinkLookupError);

    await expect(
      redeemQuotePaymentLink({
        rawToken: created.rawToken,
        invoiceId: invoiceIdA,
        tokenSecret: SECRET,
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_LINK_CONSUMED" });
  });
});
